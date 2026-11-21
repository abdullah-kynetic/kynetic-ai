import { and, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  addContactTags,
  deleteContact,
  mergeContacts,
  removeContactTags,
  restoreContact,
  setContactOwner,
  updateContact
} from '../contacts/service';
import { buildContactsCsv } from '../contacts/export';
import { CONTACT_STATUSES } from '../contacts/constants';
import type { Tx } from '../db/client';
import { contacts } from '../db/schema';
import { AppError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { uuidSchema } from '../validation';
import { plainNote } from './call-log';
import { contactDto } from './contacts-write';
import { contactExists } from './reads';

// Contact merge, delete, restore, export and bulk edits for the service API (C2). Every write is tagged
// origin 'service-api'. Each bulk action runs the same single-contact function as the one-at-a-time
// routes, inside one transaction, so a failure part-way changes nothing. Bulk enroll is not offered:
// the sequence engine is not built.

const tag = z.string().trim().min(1).max(50);

export const serviceMergeBodySchema = z.strictObject({
  survivorId: uuidSchema,
  loserId: uuidSchema
});

export const serviceBulkBodySchema = z.strictObject({
  ids: z.array(uuidSchema).min(1).max(200),
  action: z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('tag'),
      add: z.array(tag).max(20).default([]),
      remove: z.array(tag).max(20).default([])
    }),
    z.strictObject({ type: z.literal('owner'), ownerId: uuidSchema.nullable() }),
    z.strictObject({ type: z.literal('status'), status: z.enum(CONTACT_STATUSES) }),
    z.strictObject({ type: z.literal('delete') })
  ])
});
export type ServiceBulkBody = z.output<typeof serviceBulkBodySchema>;

export const serviceExportQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(CONTACT_STATUSES).optional()
});
export type ServiceExportQuery = z.output<typeof serviceExportQuerySchema>;

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });
const origin = { origin: 'service-api' as const };

/** Runs inside withServiceTenant. The survivor keeps its record; the loser is hidden. */
export async function mergeServiceContacts(
  tx: Tx,
  svc: ServiceContext,
  survivorId: string,
  loserId: string
) {
  await contactExists(tx, survivorId);
  await contactExists(tx, loserId);
  await mergeContacts(sysCtx(svc), survivorId, loserId, { tx, ...origin });
  return contactDto(tx, survivorId);
}

/** Runs inside withServiceTenant. Soft delete; the contact can be restored. */
export async function deleteServiceContact(tx: Tx, svc: ServiceContext, id: string) {
  await contactExists(tx, id);
  await deleteContact(sysCtx(svc), id, { tx, ...origin });
  return { id, deleted: true as const };
}

/** Runs inside withServiceTenant. Restoring a contact whose phone or email is now taken is a 409. */
export async function restoreServiceContact(tx: Tx, svc: ServiceContext, id: string) {
  await restoreContact(sysCtx(svc), id, { tx, ...origin });
  return contactDto(tx, id);
}

/**
 * Runs inside withServiceTenant. Checks every id is a live contact of this tenant before it changes
 * any of them; one missing id fails the whole call with nothing written.
 */
export async function bulkServiceContacts(tx: Tx, svc: ServiceContext, input: ServiceBulkBody) {
  const ids = [...new Set(input.ids)];
  const live = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(inArray(contacts.id, ids), isNull(contacts.deletedAt)));
  if (live.length !== ids.length) throw new AppError('NOT_FOUND');

  const action = input.action;
  for (const id of ids) {
    const o = { tx, ...origin };
    switch (action.type) {
      case 'tag': {
        if (action.add.length) {
          await addContactTags(
            sysCtx(svc),
            id,
            action.add.map((t) => plainNote(t)),
            o
          );
        }
        if (action.remove.length) {
          await removeContactTags(
            sysCtx(svc),
            id,
            action.remove.map((t) => plainNote(t)),
            o
          );
        }
        break;
      }
      case 'owner':
        await setContactOwner(sysCtx(svc), id, action.ownerId, o);
        break;
      case 'status':
        await updateContact(sysCtx(svc), id, { status: action.status }, o);
        break;
      case 'delete':
        await deleteContact(sysCtx(svc), id, o);
        break;
    }
  }
  return { type: action.type, requested: ids.length };
}

/**
 * Not in a transaction: the CSV builder opens its own tenant-scoped one. Columns and formula
 * neutralizing are the same as the portal export. The caller checks `contacts:export` first.
 */
export async function exportServiceContacts(svc: ServiceContext, query: ServiceExportQuery) {
  return buildContactsCsv(sysCtx(svc), {
    q: query.q,
    statuses: query.status ? [query.status] : undefined
  });
}
