import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Integration tests need a superuser URL for a throwaway Postgres 16 (TEST_DATABASE_ADMIN_URL).
// Each run creates its own database owned by kynetic_owner and drops it afterwards.
const ROLE_PASSWORDS = { owner: 'owner-test-pw', app: 'app-test-pw', worker: 'worker-test-pw' };
const bootstrapSql = fileURLToPath(new URL('../../deploy/db/bootstrap.sql', import.meta.url));
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export type TestDatabase = {
  name: string;
  /** Superuser connection, for assertions that need catalog access. */
  admin: postgres.Sql;
  owner: postgres.Sql;
  app: postgres.Sql;
  worker: postgres.Sql;
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

export async function createTestDatabase(opts: { migrate?: boolean } = {}): Promise<TestDatabase> {
  const base = adminUrl();
  const maintenance = postgres(base, { max: 1 });
  const name = `kynetic_test_${randomBytes(4).toString('hex')}`;

  // Roles are cluster-wide and idempotent to create.
  execFileSync(
    'psql',
    [
      base,
      '-q',
      '-v',
      `owner_pw=${ROLE_PASSWORDS.owner}`,
      '-v',
      `app_pw=${ROLE_PASSWORDS.app}`,
      '-v',
      `worker_pw=${ROLE_PASSWORDS.worker}`,
      '-f',
      bootstrapSql
    ],
    { stdio: 'pipe' }
  );
  await maintenance.unsafe(`CREATE DATABASE ${name} OWNER kynetic_owner`);
  await maintenance.end();

  const admin = postgres(withDb(base, name), { max: 2 });
  const owner = postgres(withDb(base, name, 'kynetic_owner', ROLE_PASSWORDS.owner), { max: 2 });
  if (opts.migrate !== false) {
    await migrate(drizzle(owner), { migrationsFolder });
  }
  const app = postgres(withDb(base, name, 'kynetic_app', ROLE_PASSWORDS.app), { max: 2 });
  const worker = postgres(withDb(base, name, 'kynetic_worker', ROLE_PASSWORDS.worker), { max: 2 });

  return {
    name,
    admin,
    owner,
    app,
    worker,
    drop: async () => {
      await Promise.all([admin.end(), owner.end(), app.end(), worker.end()]);
      const m = postgres(base, { max: 1 });
      await m.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await m.end();
    }
  };
}
