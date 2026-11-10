import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client';
import { automationRuns, automationSteps, automations } from '../db/schema';
import { withTenant, type TenantContextInput } from '../tenancy';

export type StopBucket = 'reply' | 'booking' | 'opt_out' | 'other';

/** Groups a finished run into the reason the client sees. Active, completed, and failed runs are not "stopped". */
export function stopBucket(status: string, stopReason: string | null): StopBucket | null {
  if (status === 'active' || status === 'completed' || status === 'failed') return null;
  const reason = (stopReason ?? '').toLowerCase();
  if (status === 'stopped_reply' || reason === 'reply') return 'reply';
  if (status === 'stopped_booked' || reason === 'booking' || reason === 'booked') return 'booking';
  if (reason.includes('opt')) return 'opt_out';
  return 'other';
}

export type StepView = {
  position: number;
  channel: string;
  status: 'done' | 'current' | 'upcoming' | 'failed' | 'stopped' | 'skipped';
  at: string | null;
};

export function stepView(input: {
  position: number;
  channel: string;
  currentStep: number;
  runStatus: string;
  createdAt: string;
  updatedAt: string;
}): StepView {
  const { position, currentStep, runStatus } = input;
  if (position < currentStep)
    return { position, channel: input.channel, status: 'done', at: input.updatedAt };
  if (position > currentStep) {
    return {
      position,
      channel: input.channel,
      status: runStatus === 'active' ? 'upcoming' : 'skipped',
      at: null
    };
  }
  const status =
    runStatus === 'failed'
      ? 'failed'
      : runStatus.startsWith('stopped')
        ? 'stopped'
        : runStatus === 'completed'
          ? 'done'
          : 'current';
  return { position, channel: input.channel, status, at: input.updatedAt };
}

export type AutomationSummary = {
  runs: number;
  completed: number;
  stopped: { reply: number; booking: number; optOut: number; other: number };
  failed: number;
  lastRunAt: string | null;
};

export type AutomationRunView = {
  id: string;
  status: string;
  stopReason: string | null;
  bucket: StopBucket | null;
  createdAt: string;
  updatedAt: string;
  currentStep: number;
  steps: StepView[];
};

export type AutomationHistory = {
  summary: AutomationSummary;
  runs: AutomationRunView[];
};

const emptySummary = (): AutomationSummary => ({
  runs: 0,
  completed: 0,
  stopped: { reply: 0, booking: 0, optOut: 0, other: 0 },
  failed: 0,
  lastRunAt: null
});

/** Read-only counts for the last 30 days, plus the last 50 runs and their steps. */
export async function automationHistory(
  ctx: TenantContextInput,
  templateKey: string,
  opts: { db?: Db; tx?: Tx } = {}
): Promise<AutomationHistory> {
  const run = async (tx: Tx): Promise<AutomationHistory> => {
    const [automation] = await tx
      .select({ id: automations.id })
      .from(automations)
      .where(and(eq(automations.templateKey, templateKey), eq(automations.kind, 'template')))
      .limit(1);
    if (!automation) return { summary: emptySummary(), runs: [] };
    const recent = await tx
      .select({
        status: automationRuns.status,
        stopReason: automationRuns.stopReason,
        createdAt: automationRuns.createdAt
      })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.automationId, automation.id),
          gte(automationRuns.createdAt, sql`now() - interval '30 days'`)
        )
      );
    const summary = emptySummary();
    for (const row of recent) {
      summary.runs += 1;
      if (!summary.lastRunAt || row.createdAt > summary.lastRunAt)
        summary.lastRunAt = row.createdAt;
      if (row.status === 'completed') summary.completed += 1;
      else if (row.status === 'failed') summary.failed += 1;
      else {
        const bucket = stopBucket(row.status, row.stopReason);
        if (bucket === 'reply') summary.stopped.reply += 1;
        else if (bucket === 'booking') summary.stopped.booking += 1;
        else if (bucket === 'opt_out') summary.stopped.optOut += 1;
        else if (bucket === 'other') summary.stopped.other += 1;
      }
    }
    const runs = await tx
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.automationId, automation.id))
      .orderBy(desc(automationRuns.createdAt))
      .limit(50);
    const steps = await tx
      .select()
      .from(automationSteps)
      .where(eq(automationSteps.automationId, automation.id))
      .orderBy(automationSteps.position);
    return {
      summary,
      runs: runs.map((row) => ({
        id: row.id,
        status: row.status,
        stopReason: row.stopReason,
        bucket: stopBucket(row.status, row.stopReason),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        currentStep: row.currentStep,
        steps: steps.map((step) =>
          stepView({
            position: step.position,
            channel: step.channel,
            currentStep: row.currentStep,
            runStatus: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          })
        )
      }))
    };
  };
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}
