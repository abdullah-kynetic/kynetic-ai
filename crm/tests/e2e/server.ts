import { createHmac, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { importArchive } from '../../src/server/archive';
import { seedPhase3 } from './phase3-seed';
import { seedShopDemo } from '../../src/server/db/seed/shop-demo';
import { seedShopPipeline } from '../helpers/shop';

const port = Number(process.env.E2E_PORT ?? 3100);
const baseUrl = `http://localhost:${port}`;
const storagePath = join('/tmp', 'kynetic-crm-e2e-owner.json');
const staffStoragePath = join('/tmp', 'kynetic-crm-e2e-staff.json');
const adminStoragePath = join('/tmp', 'kynetic-crm-e2e-admin.json');
const vaStoragePath = join('/tmp', 'kynetic-crm-e2e-va.json');
const enrolStoragePath = join('/tmp', 'kynetic-crm-e2e-enrol.json');
const shopStoragePath = join('/tmp', 'kynetic-crm-e2e-shop.json');
const emptyShopStoragePath = join('/tmp', 'kynetic-crm-e2e-shop-empty.json');
const SHOP_TENANT = '55555555-5555-4555-8555-555555555555';
const EMPTY_SHOP_TENANT = '66666666-6666-4666-8666-666666666666';
const SHOP_OWNER = 'cccccccc-0000-4000-8000-0000000000f1';
const EMPTY_SHOP_OWNER = 'cccccccc-0000-4000-8000-0000000000f2';
const ENROL_USER = 'cccccccc-0000-4000-8000-0000000000e1';
const RESET_USER = 'cccccccc-0000-4000-8000-0000000000e2';
const secret = 'e2e-only-secret-not-for-real-use-0000';
let db: TestDatabase | undefined;
let child: ReturnType<typeof spawn> | undefined;

// Authenticated synthetic storage state. Production builds never enable persona switching.
async function sessionState(
  persona: 'owner' | 'staff' | 'admin' | 'va' | 'shop' | 'emptyShop'
): Promise<string> {
  const userId = {
    owner: IDS.ownerA,
    staff: IDS.staffA,
    admin: IDS.admin,
    va: IDS.va,
    shop: SHOP_OWNER,
    emptyShop: EMPTY_SHOP_OWNER
  }[persona];
  const token = randomBytes(32).toString('hex');
  await db!.admin`insert into sessions (user_id, token, expires_at, two_factor_verified_at)
    values (${userId}, ${token}, now() + interval '1 hour', now())`;
  if (persona === 'admin' || persona === 'va')
    await db!.admin`update users set two_factor_enabled = true where id = ${userId}`;
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return JSON.stringify({
    cookies: [
      {
        name: 'better-auth.session_token',
        value: encodeURIComponent(`${token}.${signature}`),
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      }
    ],
    origins: []
  });
}

async function main(): Promise<void> {
  db = await createTestDatabase({ jobs: true });
  const seeded = await seedTwoTenants(db.admin);
  await importArchive(db.admin, join(process.cwd(), '..', 'docs', 'roadmap'));
  await seedPhase3(db);
  // --- lane-a fixtures ---
  await db.admin`insert into metrics_daily (tenant_id, day, leads, calls, contacts_reached, estimates_booked, won_revenue_cents)
    values (${IDS.tenantA}, '2026-09-10', 10, 15, 7, 4, 120000), (${IDS.tenantA}, '2026-09-11', 5, 6, 3, 2, 30000)`;
  await db.admin`update reports set id = 'aaaaaaaa-1000-4000-8000-000000000001' where tenant_id = ${IDS.tenantA} and period_start = '2026-09-01'`;
  await db.admin`update reports set id = 'bbbbbbbb-1000-4000-8000-000000000001' where tenant_id = ${IDS.tenantB} and period_start = '2026-09-01'`;
  const laneAOwnerBToken = randomBytes(32).toString('hex');
  await db.admin`insert into sessions (user_id, token, expires_at) values (${IDS.ownerB}, ${laneAOwnerBToken}, now() + interval '1 hour')`;
  const laneAOwnerBSignature = createHmac('sha256', secret)
    .update(laneAOwnerBToken)
    .digest('base64');
  await writeFile(
    '/tmp/kynetic-crm-e2e-lane-a-owner-b.json',
    JSON.stringify({
      cookies: [
        {
          name: 'better-auth.session_token',
          value: encodeURIComponent(`${laneAOwnerBToken}.${laneAOwnerBSignature}`),
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax'
        }
      ],
      origins: []
    })
  );
  // --- end lane-a fixtures ---

  await db.admin`insert into calls (id, tenant_id, contact_id, provider, provider_call_id, direction, started_at, summary)
    values ('cccccccc-0000-4000-8000-000000000063', '11111111-1111-4111-8111-111111111111', ${seeded.a.contactId}, 'fake', 'synthetic-a11y-detail', 'outbound', now(), 'Synthetic accessibility review call')`;
  await db.admin`insert into tenants (id, slug, name, plan, timezone) values ('33333333-3333-4333-8333-333333333333', 'tenant-c', 'Tenant C', 'founding', 'UTC')`;
  // A ready portal, so the workspace switcher's "View as client" is enabled in browser tests.
  await db.admin`insert into tenants (id, slug, name, plan, status, timezone) values ('44444444-4444-4444-8444-444444444444', 'ready-roofing', 'Ready Roofing', 'founding', 'active', 'UTC')`;
  await db.admin`update tenants set name = 'Synthetic Brand Co', primary_color = '#2563eb', business_hours = ${db.admin.json(
    {
      mon: [{ open: '08:00', close: '17:00' }],
      tue: [{ open: '08:00', close: '17:00' }],
      wed: [{ open: '08:00', close: '17:00' }],
      thu: [{ open: '08:00', close: '17:00' }],
      fri: [{ open: '08:00', close: '17:00' }]
    }
  )} where id = ${IDS.tenantA}`;
  await db.admin`update alex_configs set provider = 'elevenlabs', agent_ref = 'synthetic-e2e-agent', greeting = 'Synthetic greeting', paused = false where tenant_id = ${IDS.tenantA}`;
  await db.admin`insert into integrations (tenant_id, kind, status, last_error, last_error_at, error_count) values (${IDS.tenantA}, 'sms', 'degraded', 'Synthetic integration failure', now(), 2)`;
  await db.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, flagged, flagged_at, flag_note) values (${IDS.tenantA}, ${seeded.a.contactId}, 'fake', 'synthetic-admin-review', 'inbound', now(), true, now(), 'Synthetic flagged reason')`;
  await db.admin`insert into webhook_events (source, external_id, tenant_id, payload, attempts, last_error) values ('synthetic-m8b', 'e2e-failed-event', ${IDS.tenantA}, '{}'::jsonb, 2, 'Synthetic webhook failure')`;
  await db.admin`
    insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full')
    on conflict (tenant_id, module_key) do update set enabled = true, level = 'full'`;
  // P1-3: custom fields for each kind of record, so the browser test can edit all three.
  await db.admin`insert into custom_field_defs (tenant_id, entity, key, label, type, position) values
    (${IDS.tenantA}, 'company', 'crew_size', 'Crew size', 'number', 0),
    (${IDS.tenantA}, 'deal', 'permit_cost', 'Permit cost', 'money', 0)`;
  await db.admin`
    insert into tenant_modules (tenant_id, module_key, enabled)
    values (${IDS.tenantA}, 'opm', true)
    on conflict (tenant_id, module_key) do update set enabled = true`;
  await db.admin`insert into presence_items (tenant_id, kind, title, status)
    values (${IDS.tenantA}, 'profile', 'Google Business Profile', 'in_progress')`;
  // --- lane-a A1 fixtures ---
  await db.admin`insert into review_requests (tenant_id, contact_id, channel, status)
    values (${IDS.tenantA}, ${seeded.a.contactId}, 'sms', 'queued')`;
  await db.admin`insert into client_referrals (tenant_id, referrer_contact_id, referee_name, status, reward_cents, reward_status)
    values (${IDS.tenantA}, ${seeded.a.contactId}, 'Synthetic Referee', 'won', 7500, 'pending')`;
  // --- end lane-a A1 fixtures ---
  await db.admin`insert into review_snapshots (tenant_id, source, captured_on, review_count, average_rating)
    values (${IDS.tenantA}, 'Google', date '2026-09-14', 23, 4.70)`;
  const [importBatch] =
    await db.admin`insert into import_batches (tenant_id, entity, imported_source, file_name, file_type, status, rows_total, rows_ok)
    values (${IDS.tenantA}, 'contact', 'csv_other', 'e2e.csv', 'csv', 'done', 1, 1) returning id`;
  await db.admin`update import_batches set mapping = ${db.admin.json({ firstName: 'first_name', phone: 'phone' })} where id = ${importBatch.id}`;
  await db.admin`insert into import_batch_records (tenant_id, batch_id, entity, record_id, action)
    values (${IDS.tenantA}, ${importBatch.id}, 'contact', gen_random_uuid(), 'created')`;
  const [{ companyId }] = await db.admin`
    select id as "companyId" from companies where tenant_id = ${IDS.tenantA} limit 1`;
  await db.admin`
    insert into contacts
      (tenant_id, first_name, primary_phone_e164, primary_email, phones, emails, company_id, owner_id)
    values
      (${IDS.tenantA}, 'Duplicate', '+15555550999', 'duplicate-a@example.test',
       ARRAY['+15555550999']::text[], ARRAY['duplicate-a@example.test']::text[], ${companyId}, ${IDS.ownerA})`;
  await db.admin`update import_batches set committed_at = now() where id = ${importBatch.id}`;
  await db.admin`insert into backup_runs (kind, status, size_bytes, offsite_key, restore_test_passed)
    values ('restore_test', 'ok', 4096, 'backups/synthetic/test.dump.enc', true)`;

  // No worker runs under e2e; /api/health needs a fresh heartbeat to report ok (the readiness wait below).
  await db.admin`insert into worker_heartbeats (name, commit_sha) values ('worker', 'e2e')`;

  // AA shop track: one shop client with sample data, one with the module on and no data.
  for (const [tenantId, owner, slug, name] of [
    [SHOP_TENANT, SHOP_OWNER, 'aa-auto-body-shop', 'E2E AA Auto Body Shop'],
    [EMPTY_SHOP_TENANT, EMPTY_SHOP_OWNER, 'empty-body-shop', 'E2E Shop Without Data']
  ] as const) {
    await db.admin`insert into users (id, email, name, email_verified) values
      (${owner}, ${`${slug}-owner@example.test`}, ${`${name} Owner`}, true)`;
    await db.admin`insert into tenants (id, slug, name, plan, status, timezone)
      values (${tenantId}, ${slug}, ${name}, 'founding', 'onboarding', 'America/Chicago')`;
    await db.admin`insert into client_lifecycle (tenant_id, stage, updated_by) values (${tenantId}, 'onboarding', ${owner})`;
    await db.admin`insert into memberships (tenant_id, user_id, role) values (${tenantId}, ${owner}, 'owner')`;
    await db.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
      (${tenantId}, 'platform', true, ''), (${tenantId}, 'shop_ops', true, ''), (${tenantId}, 'crm', true, 'full')`;
    await db.admin`insert into pipelines (tenant_id, name, is_default) values (${tenantId}, 'Sales', true)`;
    await seedShopPipeline(db.admin, tenantId, []);
  }
  await seedShopDemo(db.admin, { slug: 'aa-auto-body-shop', apply: true });
  await db.admin`insert into alex_configs (tenant_id, provider, agent_ref, greeting, questions, transfer_number_e164, paused)
    values (${SHOP_TENANT}, 'elevenlabs', 'synthetic-e2e-shop-agent', 'Thanks for calling AA Auto Body.',
      ${JSON.stringify(['What year, make and model is the car?', 'Is this an insurance claim?'])}::jsonb, '+15555550142', false)`;

  await mkdir('/tmp', { recursive: true });
  await db.admin`insert into users (id, email, name, kynetic_role) values
    (${ENROL_USER}, 'enrol-va@example.test', 'Enrol VA', 'va'),
    (${RESET_USER}, 'reset-va@example.test', 'Reset VA', 'va')`;
  await db.admin`update users set two_factor_enabled = true where id = ${RESET_USER}`;
  const enrolToken = randomBytes(32).toString('hex');
  await db.admin`insert into sessions (user_id, token, expires_at)
    values (${ENROL_USER}, ${enrolToken}, now() + interval '1 hour')`;
  const enrolSignature = createHmac('sha256', secret).update(enrolToken).digest('base64');
  await writeFile(storagePath, await sessionState('owner'));
  await writeFile(staffStoragePath, await sessionState('staff'));
  await writeFile(adminStoragePath, await sessionState('admin'));
  await writeFile(vaStoragePath, await sessionState('va'));
  await writeFile(shopStoragePath, await sessionState('shop'));
  await writeFile(emptyShopStoragePath, await sessionState('emptyShop'));
  await writeFile(
    enrolStoragePath,
    JSON.stringify({
      cookies: [
        {
          name: 'better-auth.session_token',
          value: encodeURIComponent(`${enrolToken}.${enrolSignature}`),
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax'
        }
      ],
      origins: []
    })
  );

  const env = {
    ...process.env,
    APP_BASE_URL: baseUrl,
    DATABASE_URL: db.urls.app,
    DATABASE_URL_AUTH: db.authUrl,
    DATABASE_URL_WORKER: db.urls.worker,
    BETTER_AUTH_SECRET: secret,
    APP_ENCRYPTION_KEY: 'e2e-only-key-not-for-real-use-00000',
    // Synthetic browser server only. Outbound stays off so the compose gate records
    // "outbound disabled". Stub mode keeps provider adapters off. Local drafts also save in live mode.
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false',
    ELEVENLABS_LIVE_ENABLED: 'false',
    COMPONENT_GALLERY: '1'
  };
  // E2E_DEV=1 serves with `next dev` so page changes show without a build (screenshot review only).
  child = spawn('bun', ['run', process.env.E2E_DEV ? 'dev' : 'start', '-p', String(port)], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit'
  });
  child.once('exit', async () => {
    await db?.drop();
  });
  await new Promise<void>((resolve, reject) => {
    child!.once('error', reject);
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) {
          clearInterval(timer);
          resolve();
        }
      } catch {
        // The Next server is still starting.
      }
    }, 250);
    child!.once('exit', (code) => {
      clearInterval(timer);
      reject(new Error(`E2E server exited before readiness (${code ?? 'unknown'})`));
    });
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    child?.kill('SIGTERM');
    await db?.drop();
    process.exit(0);
  });
}

await main();
await new Promise(() => undefined);
