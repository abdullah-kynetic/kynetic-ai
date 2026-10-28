import { and, eq } from 'drizzle-orm';
import { getWorkerDb } from '../db/client';
import {
  automationRuns,
  automationSteps,
  automations,
  automationTemplates,
  pipelineStages
} from '../db/schema';
import { enqueue, registerWorker } from '../jobs';
import { getSmsProvider } from '../messaging/provider';
import { sendSms } from '../messaging';
import { subscribe } from '../events';
import { withTenant } from '../tenancy';

export type AutomationStepJob = { tenantId: string; runId: string };
const moduleKeys = [
  'alex_core',
  'quote_followup',
  'after_hours',
  'missed_call_textback',
  'reactivation',
  'followup_bundle'
] as const;
type AutomationModule = (typeof moduleKeys)[number];

export async function stopContactRuns(
  tenantId: string,
  contactId: string,
  reason: 'reply' | 'booked' | 'won_lost'
) {
  await withTenant(
    { tenantId, role: 'system' },
    (tx) =>
      tx
        .update(automationRuns)
        .set({
          status:
            reason === 'reply'
              ? 'stopped_reply'
              : reason === 'booked'
                ? 'stopped_booked'
                : 'stopped_won_lost',
          stopReason: reason,
          updatedAt: new Date().toISOString()
        })
        .where(and(eq(automationRuns.contactId, contactId), eq(automationRuns.status, 'active'))),
    { db: getWorkerDb() }
  );
}

export function registerAutomationSubscribers() {
  for (const [event, reason] of [
    ['message.received', 'reply'],
    ['appointment.booked', 'booked'],
    ['deal.won', 'won_lost'],
    ['deal.lost', 'won_lost']
  ] as const) {
    subscribe(event, `automation-stop-${event}`, async (env) => {
      const id = env.payload.contactId;
      if (typeof id === 'string') await stopContactRuns(env.tenantId, id, reason);
    });
  }
  subscribe(
    'lead.created',
    'automation-speed-to-lead',
    async (env) => {
      const contactId = env.payload.contactId;
      if (typeof contactId !== 'string') return;
      const { enrollInSequence } = await import('../outbound/sequences');
      await enrollInSequence(
        { tenantId: env.tenantId, role: 'system' },
        { contactId, sequenceKey: 'speed_to_lead' }
      );
    },
    { module: 'alex_core' }
  );
  subscribe(
    'deal.stage_changed',
    'automation-quote-followup',
    async (env) => {
      const stageId = env.payload.toStageId;
      const contactId = env.payload.contactId;
      if (typeof stageId !== 'string' || typeof contactId !== 'string') return;
      const [stage] = await withTenant(
        { tenantId: env.tenantId, role: 'system' },
        (tx) =>
          tx
            .select({ name: pipelineStages.name })
            .from(pipelineStages)
            .where(eq(pipelineStages.id, stageId))
            .limit(1),
        { db: getWorkerDb() }
      );
      if (stage?.name.toLowerCase() !== 'quoted') return;
      const { enrollInSequence } = await import('../outbound/sequences');
      await enrollInSequence(
        { tenantId: env.tenantId, role: 'system' },
        { contactId, sequenceKey: 'quote_followup' }
      );
    },
    { module: 'quote_followup' }
  );
}

export async function deliverAutomationStep(job: AutomationStepJob) {
  const db = getWorkerDb();
  const loaded = await withTenant(
    { tenantId: job.tenantId, role: 'system' },
    async (tx) => {
      const [run] = await tx
        .select()
        .from(automationRuns)
        .where(and(eq(automationRuns.id, job.runId), eq(automationRuns.status, 'active')))
        .limit(1);
      if (!run) return null;
      const [step] = await tx
        .select({ step: automationSteps, template: automationTemplates })
        .from(automationSteps)
        .innerJoin(automations, eq(automations.id, automationSteps.automationId))
        .leftJoin(automationTemplates, eq(automationTemplates.key, automations.templateKey))
        .where(
          and(
            eq(automationSteps.automationId, run.automationId),
            eq(automationSteps.position, run.currentStep)
          )
        )
        .limit(1);
      return { run, step };
    },
    { db }
  );
  if (!loaded || !loaded.step) {
    if (loaded)
      await withTenant(
        { tenantId: job.tenantId, role: 'system' },
        (tx) =>
          tx
            .update(automationRuns)
            .set({ status: 'completed', nextRunAt: null, updatedAt: new Date().toISOString() })
            .where(eq(automationRuns.id, job.runId)),
        { db }
      );
    return;
  }
  const { run, step } = loaded;
  if (step.step.channel !== 'sms') {
    await withTenant(
      { tenantId: job.tenantId, role: 'system' },
      (tx) =>
        tx
          .update(automationRuns)
          .set({
            status: 'failed',
            stopReason: `unsupported_channel:${step.step.channel}`,
            nextRunAt: null,
            updatedAt: new Date().toISOString()
          })
          .where(eq(automationRuns.id, run.id)),
      { db }
    );
    return;
  }
  const outboundModule: AutomationModule = moduleKeys.includes(
    (step.template?.moduleKey ?? 'quote_followup') as AutomationModule
  )
    ? (step.template?.moduleKey as AutomationModule)
    : 'quote_followup';
  const result = await sendSms(
    { tenantId: job.tenantId, role: 'system' },
    {
      contactId: run.contactId,
      module: outboundModule,
      body: step.step.body,
      idempotencyKey: `automation:${run.id}:${step.step.position}`,
      actor: { type: 'automation' }
    },
    { provider: getSmsProvider() }
  );
  if (result.status === 'blocked' && result.retryAt) {
    await enqueue('automation.step', job, {
      startAfter: result.retryAt,
      singletonKey: `automation:${run.id}:${step.step.position}:retry`
    });
    return;
  }
  if (result.status !== 'sent') return;
  await withTenant(
    { tenantId: job.tenantId, role: 'system' },
    async (tx) => {
      const [next] = await tx
        .select({ id: automationSteps.id, delay: automationSteps.delayMinutes })
        .from(automationSteps)
        .where(
          and(
            eq(automationSteps.automationId, run.automationId),
            eq(automationSteps.position, run.currentStep + 1)
          )
        )
        .limit(1);
      const nextAt = next ? new Date(Date.now() + next.delay * 60000) : null;
      await tx
        .update(automationRuns)
        .set({
          currentStep: run.currentStep + 1,
          nextRunAt: nextAt?.toISOString() ?? null,
          status: next ? 'active' : 'completed',
          updatedAt: new Date().toISOString()
        })
        .where(eq(automationRuns.id, run.id));
      if (next)
        await enqueue('automation.step', job, {
          tx,
          startAfter: nextAt!,
          singletonKey: `automation:${run.id}:${run.currentStep + 1}`
        });
    },
    { db }
  );
}

export async function registerAutomationWorker() {
  await registerWorker<AutomationStepJob>('automation.step', deliverAutomationStep);
}
