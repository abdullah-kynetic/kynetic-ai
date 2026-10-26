import { getDb, type Db, type Tx } from '../db/client';
import { tenantContextSchema, type TenantContextInput } from './context';
import { setSessionContext } from './set-context';

/**
 * Runs fn in one transaction with the tenant context set. Every tenant-scoped read or write goes
 * through here (ARCHITECTURE section 2). The context comes from the verified session, never from a
 * request parameter. A malformed context throws before any query runs.
 */
export async function withTenant<T>(
  ctx: TenantContextInput,
  fn: (tx: Tx) => Promise<T>,
  opts: { db?: Db } = {}
): Promise<T> {
  const parsed = tenantContextSchema.parse(ctx);
  const db = opts.db ?? getDb();
  return db.transaction(async (tx) => {
    await setSessionContext(tx, parsed);
    return fn(tx);
  });
}
