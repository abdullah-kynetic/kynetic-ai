import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAuth } from '../../src/server/auth';
import { createDb } from '../../src/server/db/client';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

const port = Number(process.env.E2E_PORT ?? 3100);
const baseUrl = `http://localhost:${port}`;
const storagePath = join('/tmp', 'kynetic-crm-e2e-owner.json');
const adminStoragePath = join('/tmp', 'kynetic-crm-e2e-admin.json');
const vaStoragePath = join('/tmp', 'kynetic-crm-e2e-va.json');
const termsStoragePath = join('/tmp', 'kynetic-crm-e2e-terms.json');
const termsUserId = 'ddddddd1-0000-4000-8000-000000000001';
const secret = 'e2e-only-secret-not-for-real-use-0000';
let db: TestDatabase | undefined;
let child: ReturnType<typeof spawn> | undefined;

async function signedCookie(token: string): Promise<string> {
  const { serializeSignedCookie } = await import('better-call');
  const auth = createAuth({
    db: createDb(db!.auth),
    baseUrl,
    secret,
    sendMagicLink: async () => undefined
  });
  const cookie = await serializeSignedCookie(
    'better-auth.session_token',
    token,
    (await auth.$context).secret
  );
  return decodeURIComponent(cookie.split(';')[0]!.split('=').slice(1).join('='));
}

async function main(): Promise<void> {
  db = await createTestDatabase({ jobs: true });
  const seeded = await seedTwoTenants(db.admin);
  await db.admin`insert into calls (id, tenant_id, contact_id, provider, provider_call_id, direction, started_at, summary)
    values ('cccccccc-0000-4000-8000-000000000063', '11111111-1111-4111-8111-111111111111', ${seeded.a.contactId}, 'fake', 'synthetic-a11y-detail', 'outbound', now(), 'Synthetic accessibility review call')`;
  await db.admin`insert into users (id, email) values (${termsUserId}, 'pending-terms@example.test')`;
  await db.admin`insert into memberships (tenant_id, user_id, role) values ('11111111-1111-4111-8111-111111111111', ${termsUserId}, 'owner')`;
  await db.admin`insert into tenants (id, slug, name, plan, timezone) values ('33333333-3333-4333-8333-333333333333', 'tenant-c', 'Tenant C', 'founding', 'UTC')`;
  await db.admin`update tenants set name = 'Synthetic Brand Co', primary_color = '#2563eb' where id = ${IDS.tenantA}`;
  await db.admin`update alex_configs set provider = 'elevenlabs', agent_ref = 'synthetic-e2e-agent', greeting = 'Synthetic greeting', paused = false where tenant_id = ${IDS.tenantA}`;
  await db.admin`insert into integrations (tenant_id, kind, status, last_error, last_error_at, error_count) values (${IDS.tenantA}, 'sms', 'degraded', 'Synthetic integration failure', now(), 2)`;
  await db.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, flagged, flagged_at, flag_note) values (${IDS.tenantA}, ${seeded.a.contactId}, 'fake', 'synthetic-admin-review', 'inbound', now(), true, now(), 'Synthetic flagged reason')`;
  await db.admin`insert into webhook_events (source, external_id, tenant_id, payload, attempts, last_error) values ('synthetic-m8b', 'e2e-failed-event', ${IDS.tenantA}, '{}'::jsonb, 2, 'Synthetic webhook failure')`;
  await db.admin`
    insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full')
    on conflict (tenant_id, module_key) do update set enabled = true, level = 'full'`;
  await db.admin`
    insert into tenant_modules (tenant_id, module_key, enabled)
    values (${IDS.tenantA}, 'opm', true)
    on conflict (tenant_id, module_key) do update set enabled = true`;
  await db.admin`insert into presence_items (tenant_id, kind, title, status)
    values (${IDS.tenantA}, 'profile', 'Google Business Profile', 'in_progress')`;
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
  await db.admin`insert into terms_acceptances (user_id, document, version)
    values
      (${IDS.ownerA}, 'terms', '2026-10-26-draft'),
      (${IDS.ownerA}, 'privacy', '2026-10-26-draft'),
      (${IDS.admin}, 'terms', '2026-10-26-draft'),
      (${IDS.admin}, 'privacy', '2026-10-26-draft'),
      (${IDS.va}, 'terms', '2026-10-26-draft'),
      (${IDS.va}, 'privacy', '2026-10-26-draft')`;
  await db.admin`update import_batches set committed_at = now() where id = ${importBatch.id}`;
  await db.admin`insert into backup_runs (kind, status, size_bytes, offsite_key, restore_test_passed)
    values ('restore_test', 'ok', 4096, 'backups/synthetic/test.dump.enc', true)`;

  const auth = createAuth({
    db: createDb(db.auth),
    baseUrl,
    secret,
    sendMagicLink: async () => undefined
  });
  const session = await (await auth.$context).internalAdapter.createSession(IDS.ownerA);
  const adminSession = await (await auth.$context).internalAdapter.createSession(IDS.admin);
  const vaSession = await (await auth.$context).internalAdapter.createSession(IDS.va);
  const termsSession = await (await auth.$context).internalAdapter.createSession(termsUserId);
  await db.admin`update users set two_factor_enabled = true where id = ${IDS.admin}`;
  await db.admin`update sessions set two_factor_verified_at = now() where id = ${adminSession.id}`;
  await db.admin`update users set two_factor_enabled = true where id = ${IDS.va}`;
  await db.admin`update sessions set two_factor_verified_at = now() where id = ${vaSession.id}`;
  await mkdir('/tmp', { recursive: true });
  await writeFile(
    storagePath,
    JSON.stringify({
      cookies: [
        {
          name: 'better-auth.session_token',
          value: await signedCookie(session.token),
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax'
        }
      ],
      origins: []
    })
  );
  await writeFile(
    adminStoragePath,
    JSON.stringify({
      cookies: [
        {
          name: 'better-auth.session_token',
          value: await signedCookie(adminSession.token),
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax'
        }
      ],
      origins: []
    })
  );
  await writeFile(
    vaStoragePath,
    JSON.stringify({
      cookies: [
        {
          name: 'better-auth.session_token',
          value: await signedCookie(vaSession.token),
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax'
        }
      ],
      origins: []
    })
  );
  await writeFile(
    termsStoragePath,
    JSON.stringify({
      cookies: [
        {
          name: 'better-auth.session_token',
          value: await signedCookie(termsSession.token),
          domain: 'localhost',
          path: '/',
          httpOnly: true,
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
    COMPONENT_GALLERY: '1'
  };
  child = spawn('bun', ['run', 'start', '-p', String(port)], {
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
