import type { Db, Tx } from '../db/client';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';

/** Options every shop read takes. `now` makes ages and week boundaries testable. */
export type ShopOpts = { db?: Db; tx?: Tx; now?: Date };

/**
 * Runs `fn` inside the tenant's transaction after checking the `shop_ops` module in that same
 * transaction. A tenant without the module gets ModuleDisabledError (403) and nothing is read.
 */
export async function shopRun<T>(
  ctx: TenantContextInput,
  opts: ShopOpts,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const body = async (tx: Tx) => {
    await requireModule(ctx, 'shop_ops', { tx });
    return fn(tx);
  };
  return opts.tx ? body(opts.tx) : withTenant(ctx, body, { db: opts.db });
}
