import { sql } from 'drizzle-orm';
import { getWorkerDb, type Db } from '../db/client';
import { usageDaily } from '../db/schema';
import { registerWorker } from '../jobs';
import { withTenant } from '../tenancy';

export type UsageDailyJob = { tenantId: string; day: string };

/** Rebuilds one tenant/day from calls and messages. Unknown costs are 0 and flagged. */
export async function rollupUsageDaily(job: UsageDailyJob, opts: { db?: Db } = {}) {
  const day = new Date(`${job.day}T00:00:00.000Z`);
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);
  const start = day.toISOString();
  const end = next.toISOString();
  return withTenant(
    { tenantId: job.tenantId, role: 'system' },
    async (tx) => {
      const [row] = await tx.execute<{
        call_count: number;
        call_seconds: number;
        call_cost_cents: number;
        sms_count: number;
        email_count: number;
        cost_unknown: boolean;
        llm_cost_micros: number;
      }>(sql`
        select
          (select count(*)::int from calls c
            where c.started_at >= ${start} and c.started_at < ${end}) as call_count,
          (select coalesce(sum(c.duration_s), 0)::int from calls c
            where c.started_at >= ${start} and c.started_at < ${end}) as call_seconds,
          (select coalesce(sum(c.cost_cents), 0)::int from calls c
            where c.cost_cents is not null and c.started_at >= ${start} and c.started_at < ${end}) as call_cost_cents,
          (select count(*)::int from messages m
            where m.channel = 'sms' and coalesce(m.sent_at, m.created_at) >= ${start}
              and coalesce(m.sent_at, m.created_at) < ${end}) as sms_count,
          (select count(*)::int from messages m
            where m.channel = 'email' and coalesce(m.sent_at, m.created_at) >= ${start}
              and coalesce(m.sent_at, m.created_at) < ${end}) as email_count,
          (
            exists (select 1 from calls c
              where c.cost_cents is null and c.started_at >= ${start} and c.started_at < ${end})
            or exists (select 1 from messages m
              where m.channel in ('sms', 'email')
                and coalesce(m.sent_at, m.created_at) >= ${start}
                and coalesce(m.sent_at, m.created_at) < ${end})
          ) as cost_unknown,
          (select coalesce(sum(l.cost_micros), 0)::bigint from llm_usage l
            where l.created_at >= ${start} and l.created_at < ${end}) as llm_cost_micros
      `);
      const values = row ?? {
        call_count: 0,
        call_seconds: 0,
        call_cost_cents: 0,
        sms_count: 0,
        email_count: 0,
        cost_unknown: false,
        llm_cost_micros: 0
      };
      await tx
        .insert(usageDaily)
        .values({
          tenantId: job.tenantId,
          day: job.day,
          callCount: values.call_count,
          callSeconds: values.call_seconds,
          callCostCents: values.call_cost_cents,
          smsCount: values.sms_count,
          emailCount: values.email_count,
          messageCostCents: 0,
          costUnknown: values.cost_unknown,
          llmCostMicros: Number(values.llm_cost_micros)
        })
        .onConflictDoUpdate({
          target: [usageDaily.tenantId, usageDaily.day],
          set: {
            callCount: values.call_count,
            callSeconds: values.call_seconds,
            callCostCents: values.call_cost_cents,
            smsCount: values.sms_count,
            emailCount: values.email_count,
            messageCostCents: 0,
            costUnknown: values.cost_unknown,
            llmCostMicros: Number(values.llm_cost_micros)
          }
        });
    },
    { db: opts.db ?? getWorkerDb() }
  );
}

export async function registerUsageWorker(): Promise<void> {
  await registerWorker<UsageDailyJob>('usage.daily', async (job) => {
    await rollupUsageDaily(job);
  });
}
