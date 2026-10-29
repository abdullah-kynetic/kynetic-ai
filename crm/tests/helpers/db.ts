import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { setupJobs } from '../../src/server/jobs/setup';

// Integration tests need a superuser URL for a throwaway Postgres 16 (TEST_DATABASE_ADMIN_URL).
// Each run creates its own database owned by kynetic_owner and drops it afterwards.
export const ROLE_PASSWORDS = {
  // Exercise psql's quoted-variable interpolation and URL encoding with synthetic special chars.
  owner: `owner-'quoted';$-back\\slash@-space test`,
  app: `app-'quoted';$-back\\slash@-space test`,
  worker: `worker-'quoted';$-back\\slash@-space test`,
  auth: `auth-'quoted';$-back\\slash@-space test`,
  backup: `backup-'quoted';$-back\\slash@-space test`
};
const bootstrapSql = fileURLToPath(new URL('../../deploy/db/bootstrap.sql', import.meta.url));
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export type TestDatabase = {
  name: string;
  /** Superuser connection, for assertions that need catalog access. */
  admin: postgres.Sql;
  owner: postgres.Sql;
  app: postgres.Sql;
  worker: postgres.Sql;
  backup: postgres.Sql;
  /** The Better-Auth connection (kynetic_auth). */
  auth: postgres.Sql;
  /** Connection URL for kynetic_auth, for code that builds its own client. */
  authUrl: string;
  /** Connection URLs for roles that build their own client (pg-boss). */
  urls: { app: string; worker: string; backup: string };
  drop: () => Promise<void>;
};

function adminUrl(): string {
  const url = process.env.TEST_DATABASE_ADMIN_URL;
  if (!url)
    throw new Error('TEST_DATABASE_ADMIN_URL is not set (superuser URL of a test Postgres 16)');
  return url;
}

function withDb(url: string, db: string, user?: string, password?: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  if (user) u.username = user;
  if (password) u.password = password;
  return u.toString();
}

export function bootstrapRoles(passwords = ROLE_PASSWORDS): void {
  const base = adminUrl();
  execFileSync(
    'psql',
    [
      base,
      '-q',
      '-v',
      `owner_pw=${passwords.owner}`,
      '-v',
      `app_pw=${passwords.app}`,
      '-v',
      `worker_pw=${passwords.worker}`,
      '-v',
      `auth_pw=${passwords.auth}`,
      '-v',
      `backup_pw=${passwords.backup}`,
      '-f',
      bootstrapSql
    ],
    { stdio: 'pipe' }
  );
}

export async function createTestDatabase(
  opts: { migrate?: boolean; jobs?: boolean; jobQueues?: Record<string, object> } = {}
): Promise<TestDatabase> {
  const base = adminUrl();
  const maintenance = postgres(base, { max: 1 });
  const name = `kynetic_test_${randomBytes(4).toString('hex')}`;

  // Roles are cluster-wide and idempotent to create.
  bootstrapRoles();
  await maintenance.unsafe(`CREATE DATABASE ${name} OWNER kynetic_owner`);
  await maintenance.end();

  const admin = postgres(withDb(base, name), { max: 2 });
  const owner = postgres(withDb(base, name, 'kynetic_owner', ROLE_PASSWORDS.owner), { max: 2 });
  if (opts.migrate !== false) {
    await migrate(drizzle(owner), { migrationsFolder });
    if (opts.jobs)
      await setupJobs(
        withDb(base, name, 'kynetic_owner', ROLE_PASSWORDS.owner),
        opts.jobQueues ?? {}
      );
    const backup = postgres(withDb(base, name, 'kynetic_owner', ROLE_PASSWORDS.owner), { max: 1 });
    await backup.end();
  }
  const app = postgres(withDb(base, name, 'kynetic_app', ROLE_PASSWORDS.app), { max: 2 });
  const worker = postgres(withDb(base, name, 'kynetic_worker', ROLE_PASSWORDS.worker), { max: 2 });
  const backup = postgres(withDb(base, name, 'kynetic_backup', ROLE_PASSWORDS.backup), { max: 2 });

  const authUrl = withDb(base, name, 'kynetic_auth', ROLE_PASSWORDS.auth);
  const auth = postgres(authUrl, { max: 2 });

  return {
    name,
    auth,
    authUrl,
    urls: {
      app: withDb(base, name, 'kynetic_app', ROLE_PASSWORDS.app),
      worker: withDb(base, name, 'kynetic_worker', ROLE_PASSWORDS.worker),
      backup: withDb(base, name, 'kynetic_backup', ROLE_PASSWORDS.backup)
    },
    admin,
    owner,
    app,
    worker,
    backup,
    drop: async () => {
      await Promise.all([admin.end(), owner.end(), app.end(), worker.end(), backup.end(), auth.end()]);
      const m = postgres(base, { max: 1 });
      await m.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await m.end();
    }
  };
}
