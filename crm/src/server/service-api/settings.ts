import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import type { Actor } from '../auth/permissions';
import type { Tx } from '../db/client';
import { tenants } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { businessHoursSchema } from '../settings/hours';
import { businessSettingsPatchSchema } from '../settings/business';
import {
  createTag,
  deleteTag,
  listTags,
  renameTag,
  type CreateTagInput,
  type RenameTagInput,
  type DeleteTagInput
} from '../settings/tags';
import { listTeam } from '../settings/team';
import type { ServiceContext } from '../service-auth/authenticate';
import { ownerUserId } from './owner';

// Business settings, hours, tags and the team list for the service API (C13, part 1). The tags and
// team readers are the portal's, run with the tenant's owner as the actor and the service transaction.
// Team invites and removals send email, so they are held (Tier B) and not exposed here.

const columns = {
  timezone: tenants.timezone,
  businessHours: tenants.businessHours,
  serviceArea: tenants.serviceArea,
  services: tenants.services,
  transferNumber: tenants.transferNumberE164
};

const hoursPatchSchema = z.strictObject({ businessHours: businessHoursSchema });

/** The owner as an actor, the same shape the portal builds for an owner session. */
async function ownerActor(tx: Tx, svc: ServiceContext): Promise<Actor> {
  const userId = await ownerUserId(tx, svc);
  return {
    userId,
    kyneticRole: null,
    membership: { tenantId: svc.tenantId, role: 'owner', canExport: true, canBulkDelete: true },
    viewAs: null
  };
}

async function readBusiness(tx: Tx, svc: ServiceContext) {
  const [row] = await tx.select(columns).from(tenants).where(eq(tenants.id, svc.tenantId)).limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  return row;
}

async function writeBusiness(tx: Tx, svc: ServiceContext, patch: Record<string, unknown>) {
  const before = await readBusiness(tx, svc);
  const set: Partial<typeof tenants.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (patch.timezone !== undefined) set.timezone = patch.timezone as string;
  if (patch.businessHours !== undefined) set.businessHours = patch.businessHours as never;
  if (patch.serviceArea !== undefined) set.serviceArea = patch.serviceArea as never;
  if (patch.services !== undefined) set.services = patch.services as string[];
  if (patch.transferNumber !== undefined)
    set.transferNumberE164 = patch.transferNumber as string | null;
  const [after] = await tx
    .update(tenants)
    .set(set)
    .where(eq(tenants.id, svc.tenantId))
    .returning(columns);
  await audit(tx, {
    action: 'settings.business.update',
    entity: 'tenant',
    entityId: svc.tenantId,
    before,
    after
  });
  return after;
}

/** Runs inside withServiceTenant. */
export async function getServiceBusiness(tx: Tx, svc: ServiceContext) {
  return readBusiness(tx, svc);
}

/** Runs inside withServiceTenant. Unknown keys are refused, so plan and status stay out of reach. */
export async function patchServiceBusiness(
  tx: Tx,
  svc: ServiceContext,
  body: Record<string, unknown>
) {
  const parsed = businessSettingsPatchSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError({ settings: ['invalid'] });
  return writeBusiness(tx, svc, parsed.data);
}

/** Runs inside withServiceTenant. Only the business hours. */
export async function getServiceHours(tx: Tx, svc: ServiceContext) {
  const row = await readBusiness(tx, svc);
  return { timezone: row.timezone, businessHours: row.businessHours };
}

/** Runs inside withServiceTenant. */
export async function patchServiceHours(
  tx: Tx,
  svc: ServiceContext,
  body: Record<string, unknown>
) {
  const parsed = hoursPatchSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError({ businessHours: ['invalid'] });
  const row = await writeBusiness(tx, svc, parsed.data);
  return { timezone: row.timezone, businessHours: row.businessHours };
}

/** Runs inside withServiceTenant. The tag list, with contact counts. */
export async function listServiceTags(tx: Tx, svc: ServiceContext) {
  return listTags({ tenantId: svc.tenantId, role: 'system' }, { tx });
}

/** Runs inside withServiceTenant. */
export async function createServiceTag(tx: Tx, svc: ServiceContext, body: CreateTagInput) {
  const actor = await ownerActor(tx, svc);
  return createTag({ tenantId: svc.tenantId, role: 'owner', userId: actor.userId }, actor, body, {
    tx
  });
}

/** Runs inside withServiceTenant. Renames on every contact; renaming onto an existing tag merges. */
export async function renameServiceTag(tx: Tx, svc: ServiceContext, body: RenameTagInput) {
  const actor = await ownerActor(tx, svc);
  return renameTag({ tenantId: svc.tenantId, role: 'owner', userId: actor.userId }, actor, body, {
    tx
  });
}

/** Runs inside withServiceTenant. Removes the tag from every contact; the contacts stay. */
export async function deleteServiceTag(tx: Tx, svc: ServiceContext, body: DeleteTagInput) {
  const actor = await ownerActor(tx, svc);
  return deleteTag({ tenantId: svc.tenantId, role: 'owner', userId: actor.userId }, actor, body, {
    tx
  });
}

/** Runs inside withServiceTenant. Members and pending invites. Invites and removals are held (Tier B). */
export async function getServiceTeam(tx: Tx, svc: ServiceContext) {
  const actor = await ownerActor(tx, svc);
  // The portal's team reader opens its own transaction, so it does not join the service one.
  return listTeam({ tenantId: svc.tenantId, role: 'owner', userId: actor.userId }, actor);
}
