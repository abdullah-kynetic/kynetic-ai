import { withTenant, type TenantContextInput } from '../tenancy';
import type { Tx } from '../db/client';
import type { ConsentRunOpts } from './types';

export function run<T>(
  ctx: TenantContextInput,
  opts: ConsentRunOpts,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}
