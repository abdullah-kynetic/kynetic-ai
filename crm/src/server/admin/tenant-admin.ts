import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getWorkerDb, type Db, type Tx } from '../db/client';
import { tenantModules, tenants, users } from '../db/schema';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { withTenant } from '../tenancy';
import type { StaffCaller } from './users';

type Options = { db?: Db };

/** Admin, re-checked against the database, inside the named tenant. No view-as bypass here. */
export async function asTenantAdmin<T>(
  caller: StaffCaller,
  tenantId: string,
  opts: Options,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  if (caller.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
  if (!z.uuid().safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  return withTenant(
    { tenantId, userId: caller.id, role: 'admin' },
    async (tx) => {
      await requireModule({ tenantId, role: 'admin' }, 'platform', { tx });
      const [user] = await tx
        .select({ role: users.kyneticRole })
        .from(users)
        .where(and(eq(users.id, caller.id), isNull(users.disabledAt)))
        .limit(1);
      if (user?.role !== 'admin') throw new AppError('FORBIDDEN');
      const [tenant] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) throw new AppError('NOT_FOUND');
      return fn(tx);
    },
    { db: opts.db ?? getWorkerDb() }
  );
}

export async function readPlatformConfig(tx: Tx) {
  const [platform] = await tx
    .select({ config: tenantModules.config })
    .from(tenantModules)
    .where(eq(tenantModules.moduleKey, 'platform'))
    .limit(1);
  return (platform?.config ?? {}) as Record<string, unknown>;
}
