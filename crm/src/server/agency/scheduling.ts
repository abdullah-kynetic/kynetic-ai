import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getWorkerDb, type Db } from '../db/client';
import { agencyWorkspaces, reports } from '../db/schema';
import { AppError } from '../errors';
import { scheduleRecurring, registerWorker } from '../jobs';
import { rollupMetricsDaily } from '../metrics';
import { generateMonthlyReport } from '../reports';
import { withTenant } from '../tenancy';

export const AGENCY_MAINTENANCE_CRON = '0 * * * *'; // UTC hourly reconciliation; no delivery.
export async function scheduleAgencyMaintenance(tenantId: string) {
  z.uuid().parse(tenantId);
  await scheduleRecurring(
    'app',
    'agency.maintenance',
    AGENCY_MAINTENANCE_CRON,
    { tenantId },
    `agency-maintenance/${tenantId}`
  );
}
export async function runAgencyMaintenance(
  job: { tenantId: string },
  opts: { db?: Db; now?: Date } = {}
) {
  z.uuid().parse(job.tenantId);
  const db = opts.db ?? getWorkerDb();
  const now = opts.now ?? new Date();
  const ctx = { tenantId: job.tenantId, role: 'system' as const };
  await withTenant(
    ctx,
    async (tx) => {
      const [workspace] = await tx
        .select()
        .from(agencyWorkspaces)
        .where(eq(agencyWorkspaces.tenantId, job.tenantId))
        .limit(1);
      if (!workspace) throw new AppError('FORBIDDEN');
    },
    { db }
  );
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  await rollupMetricsDaily({ tenantId: job.tenantId, day: yesterday }, { db });
  await rollupMetricsDaily({ tenantId: job.tenantId, day: now.toISOString().slice(0, 10) }, { db });
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 10);
  const exists = await withTenant(
    ctx,
    (tx) =>
      tx.select({ id: reports.id }).from(reports).where(eq(reports.periodStart, previous)).limit(1),
    { db }
  );
  if (!exists.length) await generateMonthlyReport(ctx, previous, { db });
  return {
    rolledUp: [yesterday, now.toISOString().slice(0, 10)],
    reportPeriod: previous,
    delivered: false
  };
}
export async function registerAgencyMaintenanceWorker() {
  await registerWorker<{ tenantId: string }>('agency.maintenance', async (job) => {
    await runAgencyMaintenance(job);
  });
}
