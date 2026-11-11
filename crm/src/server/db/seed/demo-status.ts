import { sql } from 'drizzle-orm';
import type { Db } from '../client';
import { withTenant } from '../../tenancy';

/** Owner-visible demo badge state, backed by migration 1040's SECURITY DEFINER function. */
export async function isDemoSeeded(
  tenantId: string,
  ownerUserId: string,
  opts: { db?: Db } = {}
): Promise<boolean> {
  return withTenant(
    { tenantId, userId: ownerUserId, role: 'owner' },
    async (tx) => {
      const rows = await tx.execute<{ seeded: boolean }>(
        sql`select is_demo_seeded(${tenantId}::uuid) as seeded`
      );
      return rows[0]?.seeded === true;
    },
    opts
  );
}
