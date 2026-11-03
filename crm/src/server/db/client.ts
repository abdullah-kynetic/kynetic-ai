import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '../env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function createDb(client: postgres.Sql): Db {
  return drizzle(client, { schema });
}

// One client per process and role, created on first use. The web app connects as kynetic_app
// (DATABASE_URL); the worker as kynetic_worker (DATABASE_URL_WORKER). Never as the owner.
const globalForDb = globalThis as unknown as {
  __kyneticDb?: Db;
  __kyneticWorkerDb?: Db;
  __kyneticAuthDb?: Db;
};

export function getDb(): Db {
  globalForDb.__kyneticDb ??= createDb(postgres(getEnv().DATABASE_URL, { max: 10 }));
  return globalForDb.__kyneticDb;
}

export function getWorkerDb(): Db {
  const env = getEnv();
  globalForDb.__kyneticWorkerDb ??= createDb(
    postgres(env.DATABASE_URL_WORKER ?? env.DATABASE_URL, { max: 5 })
  );
  return globalForDb.__kyneticWorkerDb;
}

/** The Better-Auth connection (kynetic_auth): global auth tables and the sign-in gate only. */
export function getAuthDb(): Db {
  globalForDb.__kyneticAuthDb ??= createDb(postgres(getEnv().DATABASE_URL_AUTH, { max: 5 }));
  return globalForDb.__kyneticAuthDb;
}
