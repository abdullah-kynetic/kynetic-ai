import { and, asc, eq } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { memberships } from '../db/schema';
import { AppError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';

// A service key has no user. Per-user data (notifications) and anything that needs an actor (the
// reports and usage readers check the owner role) are read as the tenant's owner: the earliest owner
// membership. A tenant with no owner membership is refused with 403, as in the support steps.

/** Runs inside withServiceTenant. */
export async function ownerUserId(tx: Tx, svc: ServiceContext): Promise<string> {
  const [row] = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.tenantId, svc.tenantId), eq(memberships.role, 'owner')))
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  if (!row) throw new AppError('FORBIDDEN');
  return row.userId;
}

/** The context the portal readers expect for the tenant's owner. The scope is the grant. */
export function ownerCtx(svc: ServiceContext, userId: string) {
  return { tenantId: svc.tenantId, userId, role: 'owner' as const, readOnly: false };
}
