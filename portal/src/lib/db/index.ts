import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;
const g = globalThis as unknown as { __portalDb?: DB; __portalSql?: postgres.Sql };

/** Runtime connection as `portal_app` (subject to RLS). Lazy so `next build` needs no DB. */
export function getDb(): DB {
  if (!g.__portalDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__portalSql = postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 10), prepare: false });
    g.__portalDb = drizzle(g.__portalSql, { schema });
  }
  return g.__portalDb;
}

export { schema };
