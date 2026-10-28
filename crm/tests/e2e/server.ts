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
  await seedTwoTenants(db.admin);
  await db.admin`
    insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full')
    on conflict (tenant_id, module_key) do update set enabled = true, level = 'full'`;
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
      (${IDS.ownerA}, 'privacy', '2026-10-26-draft')`;

  const auth = createAuth({
    db: createDb(db.auth),
    baseUrl,
    secret,
    sendMagicLink: async () => undefined
  });
  const session = await (await auth.$context).internalAdapter.createSession(IDS.ownerA);
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
