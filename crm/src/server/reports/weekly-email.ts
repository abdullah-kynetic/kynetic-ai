import { eq } from 'drizzle-orm';
import type { EmailProvider } from '../adapters/email';
import { getEmailProvider } from '../adapters/email';
import { getWorkerDb, type Db } from '../db/client';
import { memberships, tenants, users } from '../db/schema';
import { isEmailSuppressed } from '../email/events';
import { getEnv } from '../env';
import { registerWorker } from '../jobs';
import { getDashboardMetrics } from '../metrics/dashboard';
import { usersWithEmailOff } from '../notifications/preferences';
import { withTenant } from '../tenancy';
import { formatCents } from '../usage/present';

export type WeeklyEmailJob = { tenantId: string; from: string; to: string };

export function clientEmailAllowed(envEnabled: boolean, tenantEnabled: boolean): boolean {
  return envEnabled === true && tenantEnabled === true;
}

export function weeklyEmailCopy(input: {
  estimatesBooked: number;
  leads: number;
  calls: number;
  contactsReached: number;
  revenueCents: number;
  portalUrl: string;
}): { subject: string; text: string } {
  const booked = input.estimatesBooked;
  const subject = `Alex booked ${booked} ${booked === 1 ? 'estimate' : 'estimates'} for you last week`;
  const text = [
    `${subject}.`,
    '',
    `New leads: ${input.leads}.`,
    `Calls: ${input.calls}.`,
    `People reached: ${input.contactsReached}.`,
    `Estimates booked: ${booked}.`,
    `Won work: ${formatCents(input.revenueCents)}.`,
    '',
    `Open your portal: ${input.portalUrl}`
  ].join('\n');
  return { subject, text };
}

export async function sendWeeklyClientEmail(
  job: WeeklyEmailJob,
  opts: { db?: Db; provider?: EmailProvider; envEnabled?: boolean } = {}
): Promise<{ sent: number }> {
  const db = opts.db ?? getWorkerDb();
  const envEnabled = opts.envEnabled ?? getEnv().CLIENT_EMAIL_ENABLED;
  const ctx = { tenantId: job.tenantId, role: 'system' as const };
  const tenant = await withTenant(
    ctx,
    async (tx) => {
      const [row] = await tx.select({ enabled: tenants.weeklyEmailEnabled }).from(tenants).limit(1);
      return row ?? null;
    },
    { db }
  );
  if (!tenant || !clientEmailAllowed(envEnabled, tenant.enabled)) return { sent: 0 };
  const metrics = await getDashboardMetrics(ctx, job.from, job.to, { db });
  const portalUrl = `${getEnv().APP_BASE_URL.replace(/\/$/, '')}/dashboard`;
  const copy = weeklyEmailCopy({
    estimatesBooked: metrics.totals.estimatesBooked,
    leads: metrics.totals.leads,
    calls: metrics.totals.calls,
    contactsReached: metrics.totals.contactsReached,
    revenueCents: metrics.totals.revenueCents,
    portalUrl
  });
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
  const provider = opts.provider ?? getEmailProvider();
  const fromAddress = getEnv().EMAIL_FROM_ADDRESS;
  let sent = 0;
  for (const recipient of recipients) {
    if (await isEmailSuppressed(job.tenantId, recipient.email, { db })) continue;
    await provider.send({
      tenantId: job.tenantId,
      to: recipient.email,
      fromName: 'Kynetic',
      fromAddress,
      subject: copy.subject,
      text: copy.text,
      html: `<p>${copy.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('\n', '<br>')}</p>`,
      idempotencyKey: `weekly:${job.tenantId}:${job.from}:${recipient.id}`
    });
    sent += 1;
  }
  return { sent };
}

export async function registerWeeklyEmailWorker(): Promise<void> {
  await registerWorker<WeeklyEmailJob>('client.weekly_email', async (job) => {
    await sendWeeklyClientEmail(job);
  });
}
