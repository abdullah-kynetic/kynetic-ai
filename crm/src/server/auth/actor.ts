import { and, eq } from 'drizzle-orm';
import { getAuthDb, type Db } from '../db/client';
import * as schema from '../db/schema';
import type { Actor } from './permissions';
import type { AuthUser } from './index';

/**
 * Builds the Actor for one request from the database: the live Kynetic role (passed in from the
 * session user) and the caller's membership in the requested tenant. The tenant id from the request
 * is only a claim; it counts when a membership row backs it, and not when the tenant is suspended.
 */
export async function resolveActor(
  user: Pick<AuthUser, 'id' | 'kyneticRole'>,
  requestedTenantId?: string,
  deps: { db?: Db; viewAs?: Actor['viewAs'] } = {}
): Promise<Actor> {
  const db = deps.db ?? getAuthDb();
  let membership: Actor['membership'] = null;
  if (requestedTenantId) {
    const [row] = await db
      .select({
        tenantId: schema.memberships.tenantId,
        role: schema.memberships.role,
        canExport: schema.memberships.canExport,
        canBulkDelete: schema.memberships.canBulkDelete,
        status: schema.tenants.status
      })
      .from(schema.memberships)
      .innerJoin(schema.tenants, eq(schema.tenants.id, schema.memberships.tenantId))
      .where(
        and(
          eq(schema.memberships.userId, user.id),
          eq(schema.memberships.tenantId, requestedTenantId)
        )
      )
      .limit(1);
    if (row && row.status !== 'suspended' && row.status !== 'offboarded') {
      membership = {
        tenantId: row.tenantId,
        role: row.role as 'owner' | 'staff',
        canExport: row.canExport,
        canBulkDelete: row.canBulkDelete
      };
    }
  }
  return {
    userId: user.id,
    kyneticRole: user.kyneticRole,
    membership,
    viewAs: deps.viewAs ?? null
  };
}
