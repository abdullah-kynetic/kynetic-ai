import { sql } from 'drizzle-orm';
import { getWorkerDb, type Db } from '../db/client';
import { metricsDaily } from '../db/schema';
import { withTenant } from '../tenancy';
import { registerWorker } from '../jobs';

export type MetricsDailyJob = { tenantId: string; day: string };

/** Rebuilds one tenant/day from source tables. The upsert makes retries safe. */
export async function rollupMetricsDaily(job: MetricsDailyJob, opts: { db?: Db } = {}) {
  const day = new Date(`${job.day}T00:00:00.000Z`);
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);
  return withTenant(
    { tenantId: job.tenantId, role: 'system' },
    async (tx) => {
      const [row] = await tx.execute<{
        leads: number;
        calls: number;
        contacts_reached: number;
        estimates_booked: number;
        booked_value_cents: number;
        won_revenue_cents: number;
        avg_speed_to_lead_s: string | null;
        speed_to_lead_samples: number;
      }>(sql`
      with first_calls as (
        select c.contact_id, min(c.started_at) as first_started_at
        from calls c where c.direction = 'outbound' and c.started_at >= ${day.toISOString()} and c.started_at < ${next.toISOString()}
        group by c.contact_id
      ),
      won as (
        select coalesce(sum(d.value_cents), 0)::int as revenue
        from deals d where d.won_at >= ${day.toISOString()} and d.won_at < ${next.toISOString()}
        and (exists (select 1 from calls c where c.deal_id = d.id and c.direction = 'outbound')
          or exists (select 1 from appointments a where a.deal_id = d.id and a.booked_by = 'alex'))
      )
      select
        (select count(*)::int from contacts c where c.created_at >= ${day.toISOString()} and c.created_at < ${next.toISOString()} and c.deleted_at is null) as leads,
        (select count(*)::int from calls c where c.direction = 'outbound' and c.started_at >= ${day.toISOString()} and c.started_at < ${next.toISOString()}) as calls,
        (select count(distinct c.contact_id)::int from calls c where c.direction = 'outbound' and c.outcome not in ('voicemail','no_answer') and c.started_at >= ${day.toISOString()} and c.started_at < ${next.toISOString()}) as contacts_reached,
        (select count(*)::int from appointments a where a.created_at >= ${day.toISOString()} and a.created_at < ${next.toISOString()} and a.status in ('scheduled','completed','no_show')) as estimates_booked,
        (select coalesce(sum(d.value_cents), 0)::int from deals d join appointments a on a.deal_id = d.id where a.created_at >= ${day.toISOString()} and a.created_at < ${next.toISOString()} and a.status in ('scheduled','completed','no_show')) as booked_value_cents,
        (select revenue from won) as won_revenue_cents,
        (select percentile_cont(0.5) within group (order by extract(epoch from (f.first_started_at - c.created_at)))::numeric from first_calls f join contacts c on c.id = f.contact_id) as avg_speed_to_lead_s,
        (select count(*)::int from first_calls) as speed_to_lead_samples
    `);
      const values = row ?? {
        leads: 0,
        calls: 0,
        contacts_reached: 0,
        estimates_booked: 0,
        booked_value_cents: 0,
        won_revenue_cents: 0,
        avg_speed_to_lead_s: null,
        speed_to_lead_samples: 0
      };
      const [saved] = await tx
        .insert(metricsDaily)
        .values({
          tenantId: job.tenantId,
          day: job.day,
          leads: values.leads,
          calls: values.calls,
          contactsReached: values.contacts_reached,
          estimatesBooked: values.estimates_booked,
          bookedValueCents: values.booked_value_cents,
          wonRevenueCents: values.won_revenue_cents,
          avgSpeedToLeadS: values.avg_speed_to_lead_s,
          speedToLeadSamples: values.speed_to_lead_samples
        })
        .onConflictDoUpdate({
          target: [metricsDaily.tenantId, metricsDaily.day],
          set: {
            leads: values.leads,
            calls: values.calls,
            contactsReached: values.contacts_reached,
            estimatesBooked: values.estimates_booked,
            bookedValueCents: values.booked_value_cents,
            wonRevenueCents: values.won_revenue_cents,
            avgSpeedToLeadS: values.avg_speed_to_lead_s,
            speedToLeadSamples: values.speed_to_lead_samples,
            computedAt: sql`now()`
          }
        })
        .returning();
      return saved;
    },
    { db: opts.db ?? getWorkerDb() }
  );
}

export async function registerMetricsWorker(): Promise<void> {
  await registerWorker<MetricsDailyJob>('metrics.daily', async (job) => {
    await rollupMetricsDaily(job);
  });
}
