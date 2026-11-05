import { pathToFileURL } from 'node:url';
import postgres, { type Sql } from 'postgres';
import { createDb } from '../db/client';
import { getEnv } from '../env';
import { assertSyntheticOnly } from '../preview/guard';
import { readTenantSecret } from '../secrets';
import { assertDevRuntime } from './dev-runtime-worker';
import { issueLeadWebhookSecret, LEAD_SECRET } from './intake';
import { signLeadBody } from './signature';

function ensure(value: boolean, name: string): asserts value {
  if (!value) throw new Error('DEV signed-runtime check failed: ' + name);
}

/** Two signed HTTP submissions to DEV only; SQL observation; no provider or Twenty APIs. */
export async function verifyDevSignedRuntime(
  admin: Sql,
  worker: Sql,
  opts: { fetcher?: typeof fetch; timeoutMs?: number } = {}
) {
  const env = getEnv();
  assertDevRuntime(env);
  await assertSyntheticOnly(admin);
  const [tenant] = await admin<{ id: string }[]>`select id from tenants where slug = 'demo-a'`;
  ensure(!!tenant, 'synthetic tenant');
  const workerDb = createDb(worker);
  const binding = { tenantId: tenant.id, ...LEAD_SECRET };
  const secret =
    (await readTenantSecret(workerDb, binding)) ??
    (await issueLeadWebhookSecret(tenant.id, { db: workerDb }));
  const totals = async () => {
    const [counts] = await admin<{ calls: number; messages: number }[]>`select
      (select count(*)::int from calls c join contacts p on p.id=c.contact_id and p.tenant_id=c.tenant_id where c.tenant_id=${tenant.id} and p.primary_phone_e164=${env.TEST_PHONE!}) as calls,
      (select count(*)::int from messages m join contacts p on p.id=m.contact_id and p.tenant_id=m.tenant_id where m.tenant_id=${tenant.id} and p.primary_phone_e164=${env.TEST_PHONE!}) as messages`;
    return counts;
  };
  const before = await totals();
  const externalId = `DEV-runtime-${crypto.randomUUID()}`;
  const source = 'dev_runtime_smoke';
  const raw = JSON.stringify({
    externalId,
    source,
    synthetic: true,
    businessState: 'CA',
    phone: env.TEST_PHONE,
    firstName: 'DEV Runtime Smoke',
    projectType: 'DEV synthetic test',
    budget: 'DEV test',
    consent: { capturedText: 'DEV synthetic verification only. No real contact authorized.' }
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL(`/api/hooks/leads/dev/${tenant.id}`, env.APP_BASE_URL);
  const fetcher = opts.fetcher ?? fetch;
  for (const expected of ['accepted', 'duplicate']) {
    const response = await fetcher(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'Content-Type': 'application/json',
        'x-kynetic-timestamp': String(timestamp),
        'x-kynetic-signature': signLeadBody(secret, timestamp, raw)
      },
      body: raw
    });
    ensure(response.status === 200, 'intake status');
    const body = await response.json();
    ensure(body?.ok === true && body?.data?.status === expected, 'intake deduplication');
  }
  const deadline = Date.now() + (opts.timeoutMs ?? 45_000);
  let webhookId: string | undefined;
  while (Date.now() < deadline) {
    const rows = await admin<
      { id: string; processed_at: string | null }[]
    >`select id, processed_at from webhook_events where tenant_id=${tenant.id} and source='lead_webhook' and external_id=${tenant.id + ':' + source + ':' + externalId}`;
    ensure(rows.length === 1, 'one stored webhook');
    webhookId = rows[0].id;
    const [retry] = await admin<
      { n: number }[]
    >`select count(*)::int as n from pgboss.job where name='dev.lead-attempt' and data->>'webhookEventId'=${webhookId} and data->>'attempt'='1' and state='created' and start_after > now()`;
    if (rows[0].processed_at && retry.n === 1) {
      const [blocked] = await admin<
        { n: number }[]
      >`select count(*)::int as n from activities where tenant_id=${tenant.id} and meta->>'reason'='outbound_disabled' and contact_id in (select contact_id from activities where tenant_id=${tenant.id} and meta->>'externalId'=${externalId})`;
      ensure(blocked.n > 0, 'worker kill-switch denial');
      const after = await totals();
      ensure(
        after.calls === before.calls && after.messages === before.messages,
        'no calls or messages'
      );
      return {
        signed_intake: 'accepted',
        duplicate: 'duplicate',
        worker: 'processed',
        outbound: 'deferred',
        webhook_event_id: webhookId,
        new_calls: 0,
        new_messages: 0,
        provider_requests: 0,
        live_test_authorized: false
      } as const;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('DEV worker verification timed out; do not repeat an external action.');
}

async function main() {
  let admin: Sql | undefined;
  let worker: Sql | undefined;
  let code = 0;
  try {
    const env = getEnv();
    assertDevRuntime(env);
    const selector = process.env.DATABASE_URL_SEED;
    if (!selector || !env.DATABASE_URL_WORKER) throw new Error('DEV database selector missing');
    const target = new URL(selector);
    ensure(
      target.hostname === 'postgres' && target.pathname === '/kynetic',
      'DEV database selector'
    );
    admin = postgres(selector, { max: 1 });
    worker = postgres(env.DATABASE_URL_WORKER, { max: 1 });
    const result = await verifyDevSignedRuntime(admin, worker);
    process.stdout.write('PASS DEV_SIGNED_RUNTIME ' + JSON.stringify(result) + '\n');
  } catch {
    process.stderr.write(
      'FAIL DEV_SIGNED_RUNTIME; raw diagnostics withheld; no live test authorized.\n'
    );
    code = 1;
  } finally {
    await worker?.end();
    await admin?.end();
  }
  process.exit(code);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
