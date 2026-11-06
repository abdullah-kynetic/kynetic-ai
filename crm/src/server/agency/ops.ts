import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { StaffCaller } from '../admin/users';
import { listAdminTenantOverview } from '../admin/overview';
import { getLeadWebhookSettings, rotateLeadWebhookSecret } from '../admin/lead-webhooks';
import { getDb, getWorkerDb, type Db } from '../db/client';
import type { Keyring } from '../secrets/crypto';
import { AppError } from '../errors';
import { parseInput } from '../validation';
import { registerWorker, scheduleRecurring } from '../jobs';
import { getAgencyWorkspace, inAgency } from './index';
type Options = { db?: Db; secretDb?: Db; now?: Date; keyring?: Keyring };
export const AGENCY_DIGEST_CRON = '0 8 * * *';
export const AGENCY_DIGEST_TZ = 'America/Los_Angeles';
export async function scheduleAgencyDigest(tenantId: string, requestedBy: string) {
  await scheduleRecurring(
    'app',
    'agency.digest',
    AGENCY_DIGEST_CRON,
    { tenantId, requestedBy },
    `agency-digest/${tenantId}`,
    AGENCY_DIGEST_TZ
  );
}
export async function getAgencyOps(caller: StaffCaller, opts: Options = {}) {
  await inAgency(caller, async () => undefined, opts);
  const clients = await listAdminTenantOverview(
    { userId: caller.id, role: 'admin' },
    { db: opts.db }
  );
  const settings = await inAgency(
    caller,
    async (tx) => {
      const [config] = await tx.execute<{
        dev_webhook_url: string;
        workflow_name: string;
        workflow_id: string;
      }>(sql`select dev_webhook_url,workflow_name,workflow_id from agency_ops_settings limit 1`);
      return config ?? null;
    },
    opts
  );
  return { clients, settings };
}
const configSchema = z.strictObject({
  devWebhookUrl: z
    .url()
    .max(500)
    .refine((v) => {
      const u = new URL(v);
      return (
        u.origin === 'https://dev.kyneticai.com' &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        u.pathname.startsWith('/api/hooks/leads/')
      );
    }, 'DEV lead-hook URL only; no credentials/query strings'),
  workflowName: z.string().trim().startsWith('DEV - ').min(7).max(120),
  workflowId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)
});
export async function saveAgencyOps(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const i = parseInput(configSchema, raw);
  return inAgency(
    caller,
    async (tx, tenantId) => {
      // Draft metadata ONLY: never configure runtime n8n dispatch or call its API.
      await tx.execute(sql`insert into agency_ops_settings(tenant_id,dev_webhook_url,workflow_name,workflow_id,updated_by)
   values(${tenantId},${i.devWebhookUrl},${i.workflowName},${i.workflowId},${caller.id})
   on conflict(tenant_id) do update set dev_webhook_url=excluded.dev_webhook_url,workflow_name=excluded.workflow_name,workflow_id=excluded.workflow_id,updated_by=excluded.updated_by,updated_at=now()`);
    },
    opts
  );
}
export async function agencySecretStatus(caller: StaffCaller, opts: Options = {}) {
  const w = await getAgencyWorkspace(caller, false, opts);
  if (!w) throw new AppError('NOT_FOUND');
  const settings = await getLeadWebhookSettings(caller, w.tenantId, {
    db: opts.secretDb ?? getWorkerDb(),
    keyring: opts.keyring
  });
  return {
    tenantId: w.tenantId,
    leadPath: settings.leadPath,
    isSet: settings.secret.isSet,
    rotatedAt: settings.secret.rotatedAt
  };
}
export async function rotateAgencySecret(caller: StaffCaller, opts: Options = {}) {
  const w = await getAgencyWorkspace(caller, false, opts);
  if (!w) throw new AppError('NOT_FOUND');
  // Never return plaintext to the UI/logs. Native secret store encrypts and audits.
  await rotateLeadWebhookSecret(caller, w.tenantId, {
    db: opts.secretDb ?? getWorkerDb(),
    keyring: opts.keyring
  });
  return { rotated: true };
}
export async function agencyDigest(caller: StaffCaller, opts: Options = {}) {
  const { clients } = await getAgencyOps(caller, opts);
  const summary = {
    clients: clients.length,
    red: clients.filter((c) => c.healthTone === 'red').length,
    integrationErrors: clients.reduce((n, c) => n + c.integrationErrors, 0),
    onboarding: clients.filter((c) => !c.goLiveAt).length
  };
  return {
    summary,
    body: `${summary.clients} client workspaces; ${summary.red} need attention; ${summary.integrationErrors} integration errors; ${summary.onboarding} onboarding.`,
    delivered: false as const
  };
}
export async function publishAgencyDigest(
  job: { tenantId: string; requestedBy: string },
  opts: Options = {}
) {
  const caller = { id: parseInput(z.uuid(), job.requestedBy), kyneticRole: 'admin' as const };
  const db = opts.db ?? getDb();
  const w = await getAgencyWorkspace(caller, false, { db });
  if (!w || w.tenantId !== job.tenantId) throw new AppError('FORBIDDEN');
  const digest = await agencyDigest(caller, { ...opts, db });
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENCY_DIGEST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(opts.now ?? new Date());
  await inAgency(
    caller,
    async (tx, tenantId) => {
      await tx.execute(
        sql`insert into agency_alerts(tenant_id,kind,title,body,event_key) values(${tenantId},'daily_digest','Daily agency summary',${digest.body},${`digest/${day}`}) on conflict(tenant_id,event_key) do nothing`
      );
    },
    { db }
  );
  return { ...digest, inApp: true };
}
export async function registerAgencyDigestWorker() {
  await registerWorker<{ tenantId: string; requestedBy: string }>('agency.digest', async (job) => {
    await publishAgencyDigest(job);
  });
}
