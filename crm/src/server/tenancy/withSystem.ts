import { getWorkerDb, type Db, type Tx } from '../db/client';
import { setSessionContext } from './set-context';

/**
 * Worker-only context for cross-tenant schedule and retention jobs. It sets role `system` and no
 * tenant, so ordinary RLS still hides tenant rows. The job then opens `withTenant` per tenant, or
 * calls a SECURITY DEFINER function that checks `app_role() = 'system'`.
 */
export async function withSystem<T>(
  fn: (tx: Tx) => Promise<T>,
  opts: { db?: Db } = {}
): Promise<T> {
  const db = opts.db ?? getWorkerDb();
  return db.transaction(async (tx) => {
    await setSessionContext(tx, { role: 'system', readOnly: false });
    return fn(tx);
  });
}
