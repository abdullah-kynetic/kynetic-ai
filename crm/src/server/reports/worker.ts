import { eq } from 'drizzle-orm';
import { getWorkerDb } from '../db/client';
import { getStorage } from '../adapters/storage';
import { reports } from '../db/schema';
import { registerWorker } from '../jobs';
import { withTenant } from '../tenancy';
import { generateMonthlyReport } from './service';

export type MonthlyReportJob = { tenantId: string; periodStart: string };

export async function deliverMonthlyReport(job: MonthlyReportJob) {
  const result = await generateMonthlyReport(
    { tenantId: job.tenantId, role: 'system' },
    job.periodStart
  );
  await getStorage().put(
    result.report.storageKey!,
    new TextEncoder().encode(
      JSON.stringify({ periodStart: job.periodStart, sections: result.sections })
    ),
    { contentType: 'application/json' }
  );
  await withTenant(
    { tenantId: job.tenantId, role: 'system' },
    (tx) => tx.update(reports).set({ status: 'sent' }).where(eq(reports.id, result.report.id)),
    { db: getWorkerDb() }
  );
}

export async function registerReportWorker() {
  await registerWorker<MonthlyReportJob>('report.monthly', deliverMonthlyReport);
}
