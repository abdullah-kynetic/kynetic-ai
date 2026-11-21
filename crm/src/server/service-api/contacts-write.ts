import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  addContactTags,
  createContact,
  removeContactTags,
  setContactOwner,
  updateContact
} from '../contacts/service';
import { createContactSchema, updateContactSchema } from '../contacts/schemas';
import type { Tx } from '../db/client';
import { companies, contacts } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';
import { plainNote } from './call-log';
import { contactExists } from './reads';

// Contact writes for the service API (C1). Every write is tagged origin 'service-api', so the n8n push,
// automations and lead alerts skip it. Free text is reduced to plain text. A contact of another tenant
// is a 404, because RLS hides foreign rows. Responses leave out phone and email, like the list does.

const tagList = z.array(z.string().trim().min(1).max(50)).min(1).max(50);
export const contactTagsBodySchema = z.strictObject({ tags: tagList });
export const contactOwnerBodySchema = z.strictObject({ ownerId: uuidSchema.nullable() });

/** Splits the one service-only flag off the body; the rest must pass the contact schema unchanged. */
export function splitContactBody(json: unknown): {
  body: Record<string, unknown>;
  acknowledgeDuplicates: boolean;
} {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new ValidationError({ '': ['invalid_body'] });
  }
  const { acknowledgeDuplicates, ...body } = json as Record<string, unknown>;
  if (acknowledgeDuplicates !== undefined && typeof acknowledgeDuplicates !== 'boolean') {
    throw new ValidationError({ acknowledgeDuplicates: ['invalid'] });
  }
  return { body, acknowledgeDuplicates: acknowledgeDuplicates === true };
}

const cleanText = <T extends { firstName?: string; lastName?: string | null; tags?: string[] }>(
  v: T
): T => ({
  ...v,
  ...(v.firstName !== undefined ? { firstName: plainNote(v.firstName) } : {}),
  ...(v.lastName ? { lastName: plainNote(v.lastName) } : {}),
  ...(v.tags ? { tags: v.tags.map((t) => plainNote(t)).filter(Boolean) } : {})
});

/** A company of another tenant, or a deleted one, is a 404 (RLS hides foreign rows). */
async function companyExists(tx: Tx, companyId: string | null | undefined) {
  if (!companyId) return;
  const [c] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);
  if (!c) throw new AppError('NOT_FOUND');
}

/** Response shape: no phone or email, the same as the list endpoint. */
export async function contactDto(tx: Tx, id: string) {
  const [r] = await tx
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      companyId: contacts.companyId,
      status: contacts.status,
      source: contacts.source,
      tags: contacts.tags,
      ownerId: contacts.ownerId,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt
    })
    .from(contacts)
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .limit(1);
  if (!r) throw new AppError('NOT_FOUND');
  return r;
}

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });

/** Runs inside withServiceTenant. */
export async function createServiceContact(
  tx: Tx,
  svc: ServiceContext,
  body: Record<string, unknown>,
  acknowledgeDuplicates: boolean
) {
  const input = cleanText(parseInput(createContactSchema, body));
  await companyExists(tx, input.companyId);
  const row = await createContact(sysCtx(svc), input, {
    tx,
    origin: 'service-api',
    acknowledgeDuplicates
  });
  return contactDto(tx, row.id);
}

/** Runs inside withServiceTenant. Only the fields sent are changed. */
export async function updateServiceContact(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: Record<string, unknown>,
  acknowledgeDuplicates: boolean
) {
  const patch = cleanText(parseInput(updateContactSchema, body));
  if (Object.keys(patch).length === 0) throw new ValidationError({ '': ['empty'] });
  await contactExists(tx, id);
  await companyExists(tx, patch.companyId);
  await updateContact(sysCtx(svc), id, patch, {
    tx,
    origin: 'service-api',
    acknowledgeDuplicates
  });
  return { data: await contactDto(tx, id), fields: Object.keys(patch) };
}

/** Runs inside withServiceTenant. Adding a tag that is already there changes nothing. */
export async function addServiceContactTags(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  tags: string[]
) {
  await contactExists(tx, id);
  await addContactTags(sysCtx(svc), id, tags.map((t) => plainNote(t)).filter(Boolean), {
    tx,
    origin: 'service-api'
  });
  return contactDto(tx, id);
}

export async function removeServiceContactTags(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  tags: string[]
) {
  await contactExists(tx, id);
  await removeContactTags(sysCtx(svc), id, tags.map((t) => plainNote(t)).filter(Boolean), {
    tx,
    origin: 'service-api'
  });
  return contactDto(tx, id);
}

/** Runs inside withServiceTenant. The owner must be a staff member of this client (checked by the service). */
export async function setServiceContactOwner(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  ownerId: string | null
) {
  await contactExists(tx, id);
  await setContactOwner(sysCtx(svc), id, ownerId, { tx, origin: 'service-api' });
  return contactDto(tx, id);
}

/** Reads a JSON body of at most 10 KB, or throws a validation error. */
export async function readJsonBody(request: Request): Promise<{ raw: string; json: unknown }> {
  const raw = await request.text();
  if (raw.length > 10_000) throw new ValidationError({ '': ['too_big'] });
  try {
    return { raw, json: JSON.parse(raw) };
  } catch {
    throw new ValidationError({ '': ['invalid_json'] });
  }
}
