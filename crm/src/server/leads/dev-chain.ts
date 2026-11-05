import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { bookAppointment } from '../appointments';
import type { DevContactConfig } from '../consent/dev-contact';
import { getWorkerDb, type Db, type Tx } from '../db/client';
import { activities, webhookEvents } from '../db/schema';
import { getEnv } from '../env';
import { AppError } from '../errors';
import { subscribe } from '../events';
import { enqueue, registerWorker } from '../jobs';
import { withTenant } from '../tenancy';
import { parseInput } from '../validation';
import { runDevAttempt, type DevRetry } from './dev-attempt';
import { parseDevLead } from './dev-intake';
import { assertDevPortal } from './dev-policy';
import { LEAD_WEBHOOK_SOURCE } from './intake';

export const DEV_LEAD_QUEUE = 'dev.lead-attempt';
export const DEV_LEAD_SUBSCRIBER = 'dev-synthetic-lead-attempt';
export const devLeadJobSchema = z.strictObject({
  tenantId: z.uuid(),
  contactId: z.uuid(),
  dealId: z.uuid(),
  webhookEventId: z.uuid(),
  leadAt: z.iso.datetime(),
  attempt: z.number().int().min(1).max(3)
});
export type DevLeadJob = z.infer<typeof devLeadJobSchema>;
type ChainOptions = { db?: Db; config?: DevContactConfig; now?: Date; queue?: typeof enqueue };

async function assertStoredDevLead(job: DevLeadJob, config: DevContactConfig, tx: Tx) {
  assertDevPortal(config.APP_BASE_URL);
  const [event] = await tx
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.id, job.webhookEventId), eq(webhookEvents.tenantId, job.tenantId)))
    .limit(1);
  if (!event || event.source !== LEAD_WEBHOOK_SOURCE)
    throw new AppError('FORBIDDEN', { message: 'Stored DEV lead not found.' });
  const lead = parseDevLead(event.payload, config);
  const [linked] = await tx
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.contactId, job.contactId),
        eq(activities.dealId, job.dealId),
        sql`${activities.meta}->>'externalId' = ${lead.externalId}`,
        sql`${activities.meta}->>'source' = ${lead.source}`,
        sql`${activities.meta}->>'synthetic' = 'true'`
      )
    )
    .limit(1);
  if (!linked) throw new AppError('FORBIDDEN', { message: 'DEV lead linkage mismatch.' });
}

/** Queues IDs only, in the current transaction; quiet/kill deferrals keep their attempt number. */
export function devRetryScheduler(job: DevLeadJob, tx: Tx, queue: typeof enqueue = enqueue) {
  return async (retry: DevRetry) => {
    const next = parseInput(devLeadJobSchema, { ...job, attempt: retry.job.attempt });
    if (retry.job.contactId !== job.contactId)
      throw new AppError('FORBIDDEN', { message: 'DEV retry contact mismatch.' });
    await queue(DEV_LEAD_QUEUE, next, {
      tx,
      startAfter: retry.at,
      singletonKey: `dev-step3:${job.tenantId}:DEV-${job.webhookEventId}:${next.attempt}`
    });
  };
}

/** No sender is accepted here. Runtime jobs can gate/defer, but cannot dial. */
export async function runDevLeadJob(input: DevLeadJob, opts: ChainOptions = {}) {
  const job = parseInput(devLeadJobSchema, input);
  const config = opts.config ?? getEnv();
  assertDevPortal(config.APP_BASE_URL);
  const now = opts.now ?? new Date();
  const age = now.getTime() - new Date(job.leadAt).getTime();
  if (age < 0 || age >= 24 * 3_600_000) return { status: 'expired' as const };
  const db = opts.db ?? getWorkerDb();
  return withTenant(
    { tenantId: job.tenantId, role: 'system' },
    async (tx) => {
      await assertStoredDevLead(job, config, tx);
      return runDevAttempt(
        { tenantId: job.tenantId, role: 'system' },
        { contactId: job.contactId, externalId: `DEV-${job.webhookEventId}`, attempt: job.attempt },
        { tx, config, now, schedule: devRetryScheduler(job, tx, opts.queue) }
      );
    },
    { db }
  );
}

/** Explicit simulation only: native dev-DB booking, never a Cal.com request or real reservation. */
export async function bookDevSyntheticAppointment(
  input: DevLeadJob,
  slot: { startsAt: Date; endsAt: Date; simulation: true },
  opts: ChainOptions & { providerMode?: 'stub' | 'live' } = {}
) {
  const job = parseInput(devLeadJobSchema, input);
  const config = opts.config ?? getEnv();
  assertDevPortal(config.APP_BASE_URL);
  const providerMode = opts.providerMode ?? getEnv().PROVIDER_MODE;
  if (slot.simulation !== true || providerMode !== 'stub' || config.OUTBOUND_ENABLED)
    throw new AppError('FORBIDDEN', {
      message: 'Booking rehearsal requires stub mode and outbound disabled.'
    });
  const db = opts.db ?? getWorkerDb();
  return withTenant(
    { tenantId: job.tenantId, role: 'system' },
    async (tx) => {
      await assertStoredDevLead(job, config, tx);
      const appointment = await bookAppointment(
        { tenantId: job.tenantId, role: 'system' },
        {
          contactId: job.contactId,
          dealId: job.dealId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          externalEventId: `DEV-SIMULATION-${job.webhookEventId}`,
          notes:
            'DEV SYNTHETIC SIMULATION: internal test appointment only; no real calendar reservation.'
        },
        { tx, bookedBy: 'automation' }
      );
      if (appointment.contactId !== job.contactId || appointment.dealId !== job.dealId)
        throw new AppError('FORBIDDEN', { message: 'DEV appointment linkage mismatch.' });
      return appointment;
    },
    { db }
  );
}

export function registerDevLeadSubscriber(opts: { queue?: typeof enqueue; baseUrl?: string } = {}) {
  subscribe('lead.created', DEV_LEAD_SUBSCRIBER, async (event) => {
    if (event.payload.synthetic !== true) return;
    const baseUrl = opts.baseUrl ?? getEnv().APP_BASE_URL;
    assertDevPortal(baseUrl);
    const job = parseInput(devLeadJobSchema, {
      tenantId: event.tenantId,
      contactId: event.payload.contactId,
      dealId: event.payload.dealId,
      webhookEventId: event.payload.webhookEventId,
      leadAt: event.occurredAt,
      attempt: 1
    });
    await (opts.queue ?? enqueue)(DEV_LEAD_QUEUE, job, {
      singletonKey: `dev-step3:${job.tenantId}:DEV-${job.webhookEventId}:1`
    });
  });
}

export async function registerDevLeadWorker(opts: ChainOptions = {}) {
  await registerWorker<DevLeadJob>(DEV_LEAD_QUEUE, async (job) => {
    await runDevLeadJob(job, opts);
  });
}
