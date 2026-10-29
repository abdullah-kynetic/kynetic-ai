import { and, eq } from 'drizzle-orm';
import { getWorkerDb } from '../db/client';
import { getEmailProvider } from '../adapters/email';
import { getStorage } from '../adapters/storage';
import { getEnv } from '../env';
import { memberships, reports, tenants, users } from '../db/schema';
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
  const recipients = await withTenant(
    { tenantId: job.tenantId, role: 'system' },
    (tx) =>
      tx
        .select({ email: users.email, name: tenants.name })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .crossJoin(tenants)
        .where(and(eq(memberships.role, 'owner'), eq(tenants.id, job.tenantId))),
    { db: getWorkerDb() }
  );
  const env = getEnv();
  const provider = getEmailProvider();
  for (const recipient of recipients)
    await provider.send({
      tenantId: job.tenantId,
      to: recipient.email,
      fromName: recipient.name,
      fromAddress: env.EMAIL_FROM_ADDRESS,
      subject: `Monthly ROI report: ${job.periodStart}`,
      text: `Your monthly ROI report for ${job.periodStart} is ready.`,
      html: `<p>Your monthly ROI report for <strong>${job.periodStart}</strong> is ready in the portal.</p>`,
      idempotencyKey: `report:${job.tenantId}:${job.periodStart}:${recipient.email}`
    });
  await withTenant(
    { tenantId: job.tenantId, role: 'system' },
    (tx) => tx.update(reports).set({ status: 'sent' }).where(eq(reports.id, result.report.id)),
    { db: getWorkerDb() }
  );
}

export async function registerReportWorker() {
  await registerWorker<MonthlyReportJob>('report.monthly', deliverMonthlyReport);
}
