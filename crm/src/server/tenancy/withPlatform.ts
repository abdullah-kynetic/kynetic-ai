import { getDb, type Db, type Tx } from '../db/client';
import { platformContextSchema, type PlatformContext } from './context';
import { setSessionContext } from './set-context';

/**
 * For Kynetic staff calling the SECURITY DEFINER roll-up functions (SECURITY 2.3.6). It sets the
 * user and role but no tenant, so it grants no row access of its own: tenant tables still return
 * nothing here. The roll-up functions check `app_role()` themselves and write their own audit rows.
 */
export async function withPlatform<T>(
  ctx: PlatformContext,
  fn: (tx: Tx) => Promise<T>,
  opts: { db?: Db } = {}
): Promise<T> {
  const parsed = platformContextSchema.parse(ctx);
  const db = opts.db ?? getDb();
  return db.transaction(async (tx) => {
    await setSessionContext(tx, { userId: parsed.userId, role: parsed.role, readOnly: false });
    return fn(tx);
  });
}
