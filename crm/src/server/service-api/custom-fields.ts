import type { Tx } from '../db/client';
import {
  createFieldDef,
  deleteFieldDef,
  listFieldDefs,
  updateFieldDef
} from '../custom-fields/service';
import type { CreateFieldDefInput, UpdateFieldDefInput } from '../custom-fields/schemas';
import { CUSTOM_FIELD_ENTITIES, type CustomFieldEntity } from '../custom-fields/types';
import { AppError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { ownerCtx, ownerUserId } from './owner';

// Custom field definitions for the service API (C13, part 2). The portal's functions run as the
// tenant's owner, inside the service transaction. Definitions need CRM Full, so a Lite tenant gets
// MODULE_DISABLED from the portal function. Key, type and entity cannot change after create.

async function asOwner(tx: Tx, svc: ServiceContext) {
  return ownerCtx(svc, await ownerUserId(tx, svc));
}

/** The optional `entity` filter. Anything other than the three entities is refused. */
export function parseEntityFilter(raw: string | null): CustomFieldEntity | undefined {
  if (raw === null || raw === '') return undefined;
  if (!(CUSTOM_FIELD_ENTITIES as readonly string[]).includes(raw)) {
    throw new AppError('VALIDATION_FAILED');
  }
  return raw as CustomFieldEntity;
}

export async function listServiceCustomFields(
  tx: Tx,
  svc: ServiceContext,
  entity?: CustomFieldEntity
) {
  return listFieldDefs(await asOwner(tx, svc), entity, { tx });
}

export async function createServiceCustomField(
  tx: Tx,
  svc: ServiceContext,
  input: CreateFieldDefInput
) {
  return createFieldDef(await asOwner(tx, svc), input, { tx });
}

export async function updateServiceCustomField(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  patch: UpdateFieldDefInput
) {
  return updateFieldDef(await asOwner(tx, svc), id, patch, { tx });
}

/** Removes the definition and its values from every row of that entity, in the same transaction. */
export async function deleteServiceCustomField(tx: Tx, svc: ServiceContext, id: string) {
  await deleteFieldDef(await asOwner(tx, svc), id, { tx });
  return { deleted: true as const };
}
