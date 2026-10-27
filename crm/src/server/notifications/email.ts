import { and, eq } from 'drizzle-orm';
import { getEmailProvider, type EmailProvider } from '../adapters/email';
import { getWorkerDb, type Db } from '../db/client';
import { memberships, notifications, tenants, users } from '../db/schema';
import { getEnv } from '../env';
import { registerWorker } from '../jobs';
import { withTenant } from '../tenancy';

export type NotificationEmailJob = { tenantId: string; notificationId: string };

export type EmailDeps = {
  db?: Db;
  provider?: EmailProvider;
  fromAddress?: string;
  baseUrl?: string;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Only in-app paths become links; anything else is dropped so a row cannot point mail off-site. */
export function absoluteLink(link: string | null, baseUrl: string): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
  return new URL(link, baseUrl).toString();
}

export function renderNotificationEmail(
  n: { title: string; body: string | null },
  url: string | null
) {
  const text = [n.body, url ? `Open it: ${url}` : null].filter(Boolean).join('\n\n') || n.title;
  const html =
    `<p><strong>${escapeHtml(n.title)}</strong></p>` +
    (n.body ? `<p>${escapeHtml(n.body)}</p>` : '') +
    (url ? `<p><a href="${escapeHtml(url)}">Open it in your portal</a></p>` : '');
  return { subject: n.title, text, html };
}

/**
 * Emails one notification to its recipient (user_id) or to every owner of the tenant (user_id NULL),
 * through the EmailProvider. Idempotent per notification and recipient, so a retry never double-sends.
 * Every type is emailed: per-user preferences are F-36 (M9-11) and have no table in v1 (DC-078).
 * Returns the number of addresses sent to.
 */
export async function deliverNotificationEmail(
  job: NotificationEmailJob,
  deps: EmailDeps = {}
): Promise<number> {
  const env = deps.baseUrl && deps.fromAddress ? null : getEnv();
  const baseUrl = deps.baseUrl ?? env!.APP_BASE_URL;
  const fromAddress = deps.fromAddress ?? env!.EMAIL_FROM_ADDRESS;
  const provider = deps.provider ?? getEmailProvider();

  const found = await withTenant(
    { tenantId: job.tenantId, role: 'system' },
    async (tx) => {
      const [n] = await tx
        .select()
        .from(notifications)
        .where(eq(notifications.id, job.notificationId))
        .limit(1);
      if (!n) return null;
      const [tenant] = await tx
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, job.tenantId))
        .limit(1);
      const recipients = await tx
        .select({ id: users.id, email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          n.userId
            ? and(eq(memberships.tenantId, job.tenantId), eq(memberships.userId, n.userId))
            : and(eq(memberships.tenantId, job.tenantId), eq(memberships.role, 'owner'))
        );
      return { n, tenantName: tenant?.name ?? 'Kynetic', recipients };
    },
    deps.db ? { db: deps.db } : { db: getWorkerDb() }
  );
  if (!found) return 0;

  const mail = renderNotificationEmail(found.n, absoluteLink(found.n.link, baseUrl));
  for (const r of found.recipients) {
    await provider.send({
      tenantId: job.tenantId,
      to: r.email,
      fromName: found.tenantName,
      fromAddress,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      idempotencyKey: `notification:${found.n.id}:${r.id}`
    });
  }
  return found.recipients.length;
}

/** Called once by the worker process. */
export async function registerNotificationEmailWorker(): Promise<void> {
  await registerWorker<NotificationEmailJob>('notification.email', async (job) => {
    await deliverNotificationEmail(job);
  });
}
