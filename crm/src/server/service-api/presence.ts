import { sql } from 'drizzle-orm';
import type { Actor } from '../auth/permissions';
import type { Tx } from '../db/client';
import { AppError } from '../errors';
import { listPresence, savePresenceItem, type PresenceItemInput } from '../presence';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';

// Presence items (C9). Only the owner's admin key may read or change them, because the portal allows
// presence writes to Kynetic admins only. A client token gets 403 even with the scope ticked. The
// owner behind the key is looked up by a security-definer function, since runtime roles cannot read
// the key table.

/** Runs inside withServiceTenant. Returns the owner's user id for an admin key, or refuses. */
async function adminOwner(tx: Tx, svc: ServiceContext): Promise<string> {
  if (!svc.adminKeyId) throw new AppError('FORBIDDEN');
  const [row] = await tx.execute<{ owner: string | null }>(
    sql`select admin_api_key_owner(${svc.adminKeyId}::uuid) as owner`
  );
  if (!row?.owner) throw new AppError('FORBIDDEN');
  return row.owner;
}

/** Runs inside withServiceTenant. */
export async function listServicePresence(tx: Tx, svc: ServiceContext) {
  await adminOwner(tx, svc);
  return listPresence({ tenantId: svc.tenantId, role: 'system' }, { tx });
}

/** Runs inside withServiceTenant. Updates one presence item; the portal's admin check is met by the owner. */
export async function saveServicePresence(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: Record<string, unknown>
) {
  parseInput(uuidSchema, id);
  const owner = await adminOwner(tx, svc);
  const ctx = { tenantId: svc.tenantId, role: 'admin' as const, userId: owner, readOnly: false };
  const actor = { userId: owner, kyneticRole: 'admin' } as Actor;
  return savePresenceItem(ctx, actor, body as PresenceItemInput, id, { tx });
}
