import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./index";

/**
 * Every data access runs inside withScope(). It opens a transaction and sets transaction-local
 * Postgres settings that the RLS policies in drizzle/0001_rls.sql read. Callers must ALSO filter by
 * client_id explicitly — RLS is the second layer, not the only one.
 *
 * - admin:  full access (only after role + MFA checks in requireAdmin()).
 * - client: read own tenant, upload own documents, update own user row.
 * - ingest: write daily_results for the client bound to the ingest key.
 * - system: users/auth_tokens/rate_limits/ingest_keys only — used by auth before a session exists.
 */
export type Scope =
  | { role: "admin"; userId: string }
  | { role: "client"; userId: string; clientId: string }
  | { role: "ingest"; clientId: string }
  | { role: "system" };

export type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function withScope<T>(scope: Scope, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const clientId = "clientId" in scope ? scope.clientId : "";
  const userId = "userId" in scope ? scope.userId : "";
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.role', ${scope.role}, true), set_config('app.client_id', ${clientId}, true), set_config('app.user_id', ${userId}, true)`,
    );
    return fn(tx);
  });
}
