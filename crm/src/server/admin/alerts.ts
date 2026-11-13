import { sql } from 'drizzle-orm';
import type { EmailProvider } from '../adapters/email';
import { getEmailProvider } from '../adapters/email';
import { getWorkerDb, type Db } from '../db/client';
import { getEnv } from '../env';
import { withSystem } from '../tenancy';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATFORM_MAIL_TENANT = '00000000-0000-4000-8000-000000000001';

export type DigestFacts = {
  failedJobs: { name: string; count: number }[];
  failedWebhooks: number;
  leads: { name: string; count: number }[];
  flaggedCalls: { name: string; count: number }[];
  openSupport: number;
  openSystemRequests: number;
  spendWatch: { name: string; percent: number }[];
};

export function scrubErrorSummary(message: string): string {
  const cleaned = message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Job failed').slice(0, 180);
}

export function tenantIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as { tenantId?: unknown }).tenantId;
  return typeof value === 'string' && UUID.test(value) ? value : null;
}

export function jobFailureDedupeKey(queue: string, now: Date): string {
  return `job-failed:${queue}:${now.toISOString().slice(0, 13)}`;
}

export function renderAdminDigest(facts: DigestFacts): { title: string; body: string } {
  const list = (rows: { name: string; count: number }[]) =>
    rows.length ? rows.map((row) => `${row.name} ${row.count}`).join('; ') : 'none';
  const jobs = facts.failedJobs.length
    ? facts.failedJobs.map((row) => `${row.name} (${row.count})`).join(', ')
    : 'none';
  const spend = facts.spendWatch.length
    ? facts.spendWatch.map((row) => `${row.name} ${row.percent}%`).join('; ')
    : 'none';
  return {
    title: 'Daily admin digest',
    body: [
      `Failed jobs: ${jobs}.`,
      `Failed webhooks: ${facts.failedWebhooks}.`,
      `New leads: ${list(facts.leads)}.`,
      `Flagged calls not reviewed: ${list(facts.flaggedCalls)}.`,
      `Open support requests: ${facts.openSupport}.`,
      `Open system requests: ${facts.openSystemRequests}.`,
      `Clients at 80% or more of their spend cap: ${spend}.`
    ].join('\n')
  };
}

export async function emailAdmins(
  subject: string,
  text: string,
  key: string,
  opts: { db?: Db; provider?: EmailProvider }
): Promise<number> {
  if (!getEnv().ADMIN_ALERT_EMAIL_ENABLED) return 0;
  const provider = opts.provider ?? getEmailProvider();
  const fromAddress = getEnv().EMAIL_FROM_ADDRESS;
  const rows = (await withSystem((tx) => tx.execute(sql`select email from staff_admin_emails()`), {
    db: opts.db
  })) as unknown as { email: string }[];
  let sent = 0;
  for (const row of rows) {
    if (!row.email?.includes('@')) continue;
    await provider.send({
      tenantId: PLATFORM_MAIL_TENANT,
      to: row.email,
      fromName: 'Kynetic',
      fromAddress,
      subject,
      text,
      html: `<p>${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('\n', '<br>')}</p>`,
      idempotencyKey: `${key}:${row.email}`
    });
    sent += 1;
  }
  return sent;
}

export async function noteExhaustedJob(
  input: { queue: string; error: unknown; payload: unknown; now?: Date },
  opts: { db?: Db; provider?: EmailProvider } = {}
): Promise<{ notified: boolean }> {
  const now = input.now ?? new Date();
  const tenantId = tenantIdFromPayload(input.payload);
  const summary = scrubErrorSummary(
    input.error instanceof Error ? input.error.message : 'Job failed'
  );
  const body = [
    `Job ${input.queue} stopped after its retries.`,
    tenantId ? `Client ${tenantId}.` : null,
    summary
  ]
    .filter(Boolean)
    .join(' ');
  const key = jobFailureDedupeKey(input.queue, now);
  const inserted = (await withSystem(
    (tx) =>
      tx.execute(
        sql`select record_staff_notification('job_failed', ${`Job failed: ${input.queue}`}, ${body}, '/admin/operations', ${key}) as id`
      ),
    { db: opts.db ?? getWorkerDb() }
  )) as unknown as { id: string | null }[];
  const id = inserted[0]?.id;
  if (!id) return { notified: false };
  await emailAdmins(`Job failed: ${input.queue}`, body, key, opts);
  return { notified: true };
}

function asRows(value: unknown): { name: string; count: number }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const name = (row as { name?: unknown }).name;
    const count = Number((row as { count?: unknown }).count);
    if (typeof name !== 'string' || !Number.isFinite(count)) return [];
    return [{ name, count }];
  });
}

export async function buildAdminDigest(now: Date, opts: { db?: Db } = {}): Promise<DigestFacts> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const db = opts.db ?? getWorkerDb();
  const [snapshot] = (await withSystem(
    (tx) => tx.execute(sql`select staff_digest_snapshot(${since}::timestamptz) as snapshot`),
    { db }
  )) as unknown as { snapshot: Record<string, unknown> }[];
  const data = snapshot?.snapshot ?? {};
  let failedJobs: { name: string; count: number }[] = [];
  try {
    const jobs = (await db.execute(
      sql`select name, count(*)::int as count from pgboss.job_common
        where state = 'failed' and completed_on >= ${since}::timestamptz
        group by name order by name`
    )) as unknown as { name: string; count: number }[];
    failedJobs = jobs.map((row) => ({ name: String(row.name), count: Number(row.count) }));
  } catch {
    failedJobs = [];
  }
  const spend = Array.isArray(data.spend_watch) ? data.spend_watch : [];
  return {
    failedJobs,
    failedWebhooks: Number(data.failed_webhooks ?? 0),
    leads: asRows(data.leads),
    flaggedCalls: asRows(data.flagged_calls),
    openSupport: Number(data.open_support ?? 0),
    openSystemRequests: Number(data.open_system_requests ?? 0),
    spendWatch: spend.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const name = (row as { name?: unknown }).name;
      const percent = Number((row as { percent?: unknown }).percent);
      if (typeof name !== 'string' || !Number.isFinite(percent)) return [];
      return [{ name, percent }];
    })
  };
}

export function digestDedupeKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  return `admin-digest:${parts}`;
}

export async function publishAdminDigest(
  now = new Date(),
  opts: { db?: Db; provider?: EmailProvider } = {}
): Promise<{ created: boolean }> {
  const facts = await buildAdminDigest(now, opts);
  const mail = renderAdminDigest(facts);
  const key = digestDedupeKey(now);
  const inserted = (await withSystem(
    (tx) =>
      tx.execute(
        sql`select record_staff_notification('daily_digest', ${mail.title}, ${mail.body}, '/admin/operations', ${key}) as id`
      ),
    { db: opts.db ?? getWorkerDb() }
  )) as unknown as { id: string | null }[];
  if (!inserted[0]?.id) return { created: false };
  await emailAdmins(mail.title, mail.body, key, opts);
  return { created: true };
}
