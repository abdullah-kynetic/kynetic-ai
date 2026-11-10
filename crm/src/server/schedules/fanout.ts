import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { reports, tenantModules, tenants } from '../db/schema';
import { enqueue, registerWorker, scheduleRecurring, type QueueName } from '../jobs';
import { withSystem, withTenant, type TenantContextInput } from '../tenancy';
import { addUtcDays, parseReportDay, previousMonthStart, utcDay, zonedDate } from './calendar';

export const METRICS_FANOUT_CRON = '5 * * * *';
export const REPORT_FANOUT_CRON = '20 * * * *';

type ScheduledTenant = { tenantId: string; timezone: string; reportDay: number };
type Send = (
  queue: QueueName,
  payload: object,
  opts: { singletonKey: string }
) => Promise<string | null>;

async function listTenants(purpose: 'metrics' | 'retention', opts: { db?: Db }) {
  return withSystem(async (tx) => {
    const rows = await tx.execute<{
      tenant_id: string;
      timezone: string;
      report_day: number | string;
    }>(sql`select tenant_id, timezone, report_day from list_schedule_tenants(${purpose})`);
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      timezone: row.timezone,
      reportDay: Number(row.report_day)
    }));
  }, opts);
}

export async function listScheduledTenants(opts: { db?: Db } = {}): Promise<ScheduledTenant[]> {
  return listTenants('metrics', opts);
}

export async function listRetentionTenants(opts: { db?: Db } = {}): Promise<ScheduledTenant[]> {
  return listTenants('retention', opts);
}

/**
 * Enqueues one idempotent metrics rebuild per operating tenant for today and yesterday (UTC).
 * The handler writes through withTenant, so one tenant's job cannot see another tenant's rows.
 */
export async function runMetricsFanout(
  opts: { db?: Db; now?: Date; send?: Send } = {}
): Promise<{ queued: number }> {
  const now = opts.now ?? new Date();
  const send = opts.send ?? ((queue, payload, extra) => enqueue(queue, payload, extra));
  const days = [utcDay(now), utcDay(addUtcDays(now, -1))];
  let queued = 0;
  for (const tenant of await listScheduledTenants(opts)) {
    for (const day of days) {
      const id = await send(
        'metrics.daily',
        { tenantId: tenant.tenantId, day },
        { singletonKey: `metrics/${tenant.tenantId}/${day}` }
      );
      if (id) queued += 1;
    }
  }
  return { queued };
}

/**
 * On the tenant's configured local day, enqueue the previous month's report. A report already
 * marked sent is not queued again. The monthly worker is itself idempotent on the period key.
 */
export async function runReportFanout(
  opts: { db?: Db; now?: Date; send?: Send } = {}
): Promise<{ queued: number }> {
  const now = opts.now ?? new Date();
  const send = opts.send ?? ((queue, payload, extra) => enqueue(queue, payload, extra));
  let queued = 0;
  for (const tenant of await listScheduledTenants(opts)) {
    const local = zonedDate(now, tenant.timezone);
    if (local.day !== tenant.reportDay) continue;
    const periodStart = previousMonthStart(local.year, local.month);
    const alreadySent = await withTenant(
      { tenantId: tenant.tenantId, role: 'system' },
      async (tx) => {
        const [row] = await tx
          .select({ status: reports.status })
          .from(reports)
          .where(and(eq(reports.kind, 'monthly_roi'), eq(reports.periodStart, periodStart)))
          .limit(1);
        return row?.status === 'sent';
      },
      { db: opts.db }
    );
    if (alreadySent) continue;
    const id = await send(
      'report.monthly',
      { tenantId: tenant.tenantId, periodStart },
      { singletonKey: `report/${tenant.tenantId}/${periodStart}` }
    );
    if (id) queued += 1;
  }
  return { queued };
}

export async function readReportSchedule(ctx: TenantContextInput, opts: { db?: Db } = {}) {
  return withTenant(
    ctx,
    async (tx) => {
      const [tenant] = await tx.select({ timezone: tenants.timezone }).from(tenants).limit(1);
      const [mod] = await tx
        .select({ config: tenantModules.config })
        .from(tenantModules)
        .where(eq(tenantModules.moduleKey, 'platform'))
        .limit(1);
      const config = mod?.config as { reportDayOfMonth?: unknown } | undefined;
      return {
        day: parseReportDay(config?.reportDayOfMonth),
        timezone: tenant?.timezone ?? 'UTC'
      };
    },
    opts
  );
}

export async function registerScheduleWorkers(): Promise<void> {
  await registerWorker('metrics.fanout', async () => {
    await runMetricsFanout();
  });
  await registerWorker('report.fanout', async () => {
    await runReportFanout();
  });
}

export async function scheduleTenantJobs(): Promise<void> {
  await scheduleRecurring(
    'worker',
    'metrics.fanout',
    METRICS_FANOUT_CRON,
    {},
    'metrics-daily-fanout'
  );
  await scheduleRecurring(
    'worker',
    'report.fanout',
    REPORT_FANOUT_CRON,
    {},
    'report-monthly-fanout'
  );
}
