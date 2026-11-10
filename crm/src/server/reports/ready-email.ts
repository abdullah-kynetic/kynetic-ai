import { eq } from 'drizzle-orm';
import type { EmailProvider } from '../adapters/email';
import { getEmailProvider } from '../adapters/email';
import { getWorkerDb, type Db } from '../db/client';
import { memberships, tenants, users } from '../db/schema';
import { isEmailSuppressed } from '../email/events';
import { getEnv } from '../env';
import { subscribe, type EventEnvelope } from '../events';
import { usersWithEmailOff } from '../notifications/preferences';
import { withTenant } from '../tenancy';
import { clientEmailAllowed } from './weekly-email';

export async function deliverReportReadyEmail(
  input: { tenantId: string; reportId: string; periodStart: string },
  opts: { db?: Db; provider?: EmailProvider; envEnabled?: boolean } = {}
): Promise<{ sent: number }> {
  const db = opts.db ?? getWorkerDb();
  const envEnabled = opts.envEnabled ?? getEnv().CLIENT_EMAIL_ENABLED;
  const ctx = { tenantId: input.tenantId, role: 'system' as const };
  const [tenant] = await withTenant(
    ctx,
    (tx) =>
      tx
        .select({ enabled: tenants.reportEmailEnabled })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1),
    { db }
  );
  if (!tenant || !clientEmailAllowed(envEnabled, tenant.enabled)) return { sent: 0 };
  const recipients = await withTenant(
    ctx,
    async (tx) => {
      const rows = await tx
        .select({ id: users.id, email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.role, 'owner'));
      const optedOut = await usersWithEmailOff(
        tx,
        rows.map((row) => row.id),
        'report_ready'
      );
      return rows.filter((row) => !optedOut.has(row.id));
    },
    { db }
  );
  const base = getEnv().APP_BASE_URL.replace(/\/$/, '');
  const link = `${base}/dashboard/reports/${input.reportId}`;
  const subject = `Your monthly report is ready`;
  const text = `Your monthly report for ${input.periodStart} is ready.\n\nOpen it in the portal: ${link}`;
  const provider = opts.provider ?? getEmailProvider();
  const fromAddress = getEnv().EMAIL_FROM_ADDRESS;
  let sent = 0;
  for (const recipient of recipients) {
    if (await isEmailSuppressed(input.tenantId, recipient.email, { db })) continue;
    await provider.send({
      tenantId: input.tenantId,
      to: recipient.email,
      fromName: 'Kynetic',
      fromAddress,
      subject,
      text,
      html: `<p>Your monthly report for ${input.periodStart} is ready.</p><p><a href="${link}">Open it in the portal</a></p>`,
      idempotencyKey: `report-email:${input.reportId}:${recipient.id}`
    });
    sent += 1;
  }
  return { sent };
}

export function registerReportReadyEmail(): void {
  subscribe('report.ready', 'report-ready-email', async (env: EventEnvelope) => {
    const reportId = typeof env.payload.reportId === 'string' ? env.payload.reportId : '';
    const periodStart = typeof env.payload.periodStart === 'string' ? env.payload.periodStart : '';
    if (!reportId || !periodStart) return;
    await deliverReportReadyEmail({ tenantId: env.tenantId, reportId, periodStart });
  });
}
