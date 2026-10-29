import { and, desc, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { audit } from '../audit';
import type { Db, Tx } from '../db/client';
import { contacts, memberships } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { validateCustomValues } from '../custom-fields';
import { emitEvent } from '../events';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import {
  createContactSchema,
  listContactsSchema,
  uniqueTags,
  updateContactSchema,
  type CreateContactInput,
  type ListContactsInput,
  type UpdateContactInput
} from './schemas';

// Contacts service (M1-01; PRD F-05, F-07; DATABASE contacts). Every function runs through
// withTenant, so RLS is the last line of tenant isolation and a read-only view-as session cannot
// write. Pass `tx` to join a caller's transaction (imports, lead intake), or `db` in tests.

export type Contact = typeof contacts.$inferSelect;
export type ContactOpts = { db?: Db; tx?: Tx };

function run<T>(ctx: TenantContextInput, opts: ContactOpts, fn: (tx: Tx) => Promise<T>) {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}

const actorOf = (ctx: TenantContextInput) => ({ type: 'user' as const, id: ctx.userId });

export class NotFoundError extends AppError {
  constructor() {
    super('NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/** Another live contact shares a phone or email (F-07). The UI offers merge or "create anyway". */
export class DuplicateContactError extends AppError {
  constructor(readonly matches: DuplicateMatch[]) {
    super('CONFLICT', { message: 'A contact with this phone or email already exists.' });
    this.name = 'DuplicateContactError';
  }
}

export type DuplicateMatch = {
  id: string;
  firstName: string;
  lastName: string | null;
  matchedPhones: string[];
  matchedEmails: string[];
};

const textArray = (values: string[]) =>
  sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  )}]::text[]`;

/**
 * Live contacts in the tenant that share any of the given phones (E.164) or emails (lower-case).
 * Soft-deleted and merged-away contacts never match. Pass `excludeId` when editing.
 */
export async function findDuplicates(
  ctx: TenantContextInput,
  input: { phones?: string[]; emails?: string[]; excludeId?: string },
  opts: ContactOpts = {}
): Promise<DuplicateMatch[]> {
  const phones = input.phones ?? [];
  const emails = input.emails ?? [];
  return run(ctx, opts, (tx) => findDuplicatesIn(tx, phones, emails, input.excludeId));
}

async function findDuplicatesIn(
  tx: Tx,
  phones: string[],
  emails: string[],
  excludeId?: string
): Promise<DuplicateMatch[]> {
  const any: SQL[] = [];
  if (phones.length) any.push(sql`${contacts.phones} && ${textArray(phones)}`);
  if (emails.length) any.push(sql`${contacts.emails} && ${textArray(emails)}`);
  if (!any.length) return [];
  const rows = await tx
    .select()
    .from(contacts)
    .where(
      and(
        isNull(contacts.deletedAt),
        isNull(contacts.mergedIntoId),
        excludeId ? ne(contacts.id, excludeId) : undefined,
        or(...any)
      )
    )
    .limit(20);
  return rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    matchedPhones: r.phones.filter((p) => phones.includes(p)),
    matchedEmails: r.emails.filter((e) => emails.includes(e))
  }));
}

async function assertOwner(tx: Tx, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const [m] = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.userId, ownerId))
    .limit(1);
  if (!m) throw new ValidationError({ ownerId: ['not_a_member'] });
}

export type CreateOpts = ContactOpts & {
  /** Create even when a duplicate exists (the user saw the warning and chose to). */
  acknowledgeDuplicates?: boolean;
  /** Emit `lead.created` too (a manual lead, ARCHITECTURE section 6). */
  asLead?: boolean;
};

export async function createContact(
  ctx: TenantContextInput,
  input: CreateContactInput,
  opts: CreateOpts = {}
): Promise<Contact> {
  const v = parseInput(createContactSchema, input);
  return run(ctx, opts, async (tx) => {
    if (!opts.acknowledgeDuplicates) {
      const dupes = await findDuplicatesIn(tx, v.phones, v.emails);
      if (dupes.length) throw new DuplicateContactError(dupes);
    }
    await assertOwner(tx, v.ownerId);
    const custom = await validateCustomValues(ctx, tx, 'contact', v.custom);
    const [row] = await tx
      .insert(contacts)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        firstName: v.firstName,
        lastName: v.lastName ?? null,
        companyId: v.companyId ?? null,
        phones: v.phones,
        emails: v.emails,
        primaryPhoneE164: v.phones[0] ?? null,
        primaryEmail: v.emails[0] ?? null,
        address: v.address,
        timezone: v.timezone ?? null,
        source: v.source ?? (opts.asLead ? 'manual' : null),
        status: v.status,
        tags: v.tags,
        ownerId: v.ownerId ?? null,
        custom
      })
      .returning();
    await audit(tx, {
      action: 'contact.create',
      entity: 'contact',
      entityId: row.id,
      after: { source: row.source, status: row.status, ownerId: row.ownerId }
    });
    await emitEvent(tx, {
      name: 'contact.created',
      tenantId: row.tenantId,
      actor: actorOf(ctx),
      payload: { contactId: row.id, source: row.source, importBatchId: null }
    });
    if (opts.asLead) {
      await emitEvent(tx, {
        name: 'lead.created',
        tenantId: row.tenantId,
        actor: actorOf(ctx),
        payload: { contactId: row.id, source: row.source }
      });
    }
    return row;
  });
}

/** A lead typed in by a person: creates the contact and emits `lead.created` (source defaults to `manual`). */
export function createManualLead(
  ctx: TenantContextInput,
  input: CreateContactInput,
  opts: Omit<CreateOpts, 'asLead'> = {}
): Promise<Contact> {
  return createContact(ctx, input, { ...opts, asLead: true });
}

export async function getContact(
  ctx: TenantContextInput,
  id: string,
  opts: ContactOpts & { includeDeleted?: boolean } = {}
): Promise<Contact> {
  parseInput(uuidSchema, id);
  return run(ctx, opts, async (tx) => {
    const [row] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), opts.includeDeleted ? undefined : isNull(contacts.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function listContacts(
  ctx: TenantContextInput,
  input: ListContactsInput = {},
  opts: ContactOpts = {}
): Promise<Contact[]> {
  const { limit, offset } = parseInput(listContactsSchema, input);
  return run(ctx, opts, (tx) =>
    tx
      .select()
      .from(contacts)
      .where(and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)))
      .orderBy(desc(contacts.updatedAt), desc(contacts.id))
      .limit(limit)
      .offset(offset)
  );
}

async function loadLive(tx: Tx, id: string): Promise<Contact> {
  const [row] = await tx
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .for('update')
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

export async function updateContact(
  ctx: TenantContextInput,
  id: string,
  patch: UpdateContactInput,
  opts: ContactOpts & { acknowledgeDuplicates?: boolean } = {}
): Promise<Contact> {
  const v = parseInput(updateContactSchema, patch);
  return run(ctx, opts, async (tx) => {
    const before = await loadLive(tx, id);
    const phones = v.phones ?? before.phones;
    const emails = v.emails ?? before.emails;
    if (phones.length + emails.length === 0) {
      throw new ValidationError({ phones: ['phone_or_email_required'] });
    }
    if ((v.phones || v.emails) && !opts.acknowledgeDuplicates) {
      const dupes = await findDuplicatesIn(tx, v.phones ?? [], v.emails ?? [], id);
      if (dupes.length) throw new DuplicateContactError(dupes);
    }
    if (v.ownerId !== undefined) await assertOwner(tx, v.ownerId);
    if (v.custom !== undefined) v.custom = await validateCustomValues(ctx, tx, 'contact', v.custom);

    const set: Partial<typeof contacts.$inferInsert> = {
      updatedAt: sql`now()` as unknown as string
    };
    const { phones: _p, emails: _e, ...rest } = v;
    Object.assign(set, rest);
    if (v.phones) Object.assign(set, { phones, primaryPhoneE164: phones[0] ?? null });
    if (v.emails) Object.assign(set, { emails, primaryEmail: emails[0] ?? null });

    const [after] = await tx.update(contacts).set(set).where(eq(contacts.id, id)).returning();
    const changed = (Object.keys(v) as (keyof typeof v)[]).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );
    if (changed.length) {
      await audit(tx, {
        action: 'contact.update',
        entity: 'contact',
        entityId: id,
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, after[k]]))
      });
      await emitEvent(tx, {
        name: 'contact.updated',
        tenantId: after.tenantId,
        actor: actorOf(ctx),
        payload: { contactId: id, changed }
      });
    }
    return after;
  });
}

export const setContactOwner = (
  ctx: TenantContextInput,
  id: string,
  ownerId: string | null,
  opts: ContactOpts = {}
) => updateContact(ctx, id, { ownerId }, opts);

export async function addContactTags(
  ctx: TenantContextInput,
  id: string,
  tags: string[],
  opts: ContactOpts = {}
): Promise<Contact> {
  return run(ctx, opts, async (tx) => {
    const cur = await loadLive(tx, id);
    return updateContact(ctx, id, { tags: uniqueTags([...cur.tags, ...tags]) }, { tx });
  });
}

export async function removeContactTags(
  ctx: TenantContextInput,
  id: string,
  tags: string[],
  opts: ContactOpts = {}
): Promise<Contact> {
  return run(ctx, opts, async (tx) => {
    const cur = await loadLive(tx, id);
    const drop = new Set(tags.map((t) => t.trim().toLowerCase()));
    return updateContact(
      ctx,
      id,
      { tags: cur.tags.filter((t) => !drop.has(t.toLowerCase())) },
      { tx }
    );
  });
}

/** Soft delete: the row stays (consent evidence, history) but leaves every list and duplicate check. */
export async function deleteContact(
  ctx: TenantContextInput,
  id: string,
  opts: ContactOpts = {}
): Promise<void> {
  await run(ctx, opts, async (tx) => {
    const row = await loadLive(tx, id);
    await tx
      .update(contacts)
      .set({
        deletedAt: sql`now()` as unknown as string,
        updatedAt: sql`now()` as unknown as string
      })
      .where(eq(contacts.id, id));
    await audit(tx, { action: 'contact.delete', entity: 'contact', entityId: id });
    await emitEvent(tx, {
      name: 'contact.deleted',
      tenantId: row.tenantId,
      actor: actorOf(ctx),
      payload: { contactId: id }
    });
  });
}

/** Undo a soft delete. Refused with the matches when a live contact now holds the same phone or email. */
export async function restoreContact(
  ctx: TenantContextInput,
  id: string,
  opts: ContactOpts & { acknowledgeDuplicates?: boolean } = {}
): Promise<Contact> {
  return run(ctx, opts, async (tx) => {
    const [row] = await tx
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .for('update')
      .limit(1);
    if (!row || !row.deletedAt || row.mergedIntoId) throw new NotFoundError();
    if (!opts.acknowledgeDuplicates) {
      const dupes = await findDuplicatesIn(tx, row.phones, row.emails, id);
      if (dupes.length) throw new DuplicateContactError(dupes);
    }
    const [after] = await tx
      .update(contacts)
      .set({ deletedAt: null, updatedAt: sql`now()` as unknown as string })
      .where(eq(contacts.id, id))
      .returning();
    await audit(tx, { action: 'contact.restore', entity: 'contact', entityId: id });
    await emitEvent(tx, {
      name: 'contact.updated',
      tenantId: after.tenantId,
      actor: actorOf(ctx),
      payload: { contactId: id, changed: ['deletedAt'] }
    });
    return after;
  });
}

/**
 * Merge two live contacts in one transaction. The selected survivor keeps its identity; all
 * contact-linked history moves to it, while the loser remains as evidence and is hidden from live
 * reads. The tenant context and RLS enforce that both ids belong to the caller's tenant.
 */
export async function mergeContacts(
  ctx: TenantContextInput,
  survivorId: string,
  loserId: string,
  opts: ContactOpts = {}
): Promise<Contact> {
  parseInput(uuidSchema, survivorId);
  parseInput(uuidSchema, loserId);
  if (survivorId === loserId) throw new ValidationError({ loserId: ['must_be_different'] });

  return run(ctx, opts, async (tx) => {
    const rows = await tx
      .select()
      .from(contacts)
      .where(
        and(
          inArray(contacts.id, [survivorId, loserId]),
          isNull(contacts.deletedAt),
          isNull(contacts.mergedIntoId)
        )
      )
      .for('update');
    const survivor = rows.find((r) => r.id === survivorId);
    const loser = rows.find((r) => r.id === loserId);
    if (!survivor || !loser) throw new NotFoundError();

    // A deal can already be linked to both contacts. Insert the survivor link first and then
    // remove the loser link, preserving the composite primary key.
    await tx.execute(sql`
      INSERT INTO deal_contacts (tenant_id, deal_id, contact_id, role)
      SELECT tenant_id, deal_id, ${survivorId}::uuid, role
      FROM deal_contacts
      WHERE tenant_id = app_tenant_id() AND contact_id = ${loserId}::uuid
      ON CONFLICT (deal_id, contact_id) DO NOTHING`);
    await tx.execute(sql`
      DELETE FROM deal_contacts
      WHERE tenant_id = app_tenant_id() AND contact_id = ${loserId}::uuid`);

    for (const table of [
      'activities',
      'tasks',
      'notes',
      'calls',
      'messages',
      'dnc_entries',
      'appointments',
      'automation_runs'
    ]) {
      await tx.execute(
        sql.raw(
          `UPDATE ${table} SET contact_id = '${survivorId}'::uuid WHERE tenant_id = app_tenant_id() AND contact_id = '${loserId}'::uuid`
        )
      );
    }
    // Consent history is append-only by design. Copy the evidence to the survivor and leave the
    // loser rows untouched, so the merge never rewrites or deletes compliance records.
    await tx.execute(sql`
      INSERT INTO consents
        (tenant_id, contact_id, channel, kind, source, captured_text, wording_version, ip, captured_at, revoked_at)
      SELECT tenant_id, ${survivorId}::uuid, channel, kind, source, captured_text, wording_version, ip, captured_at, revoked_at
      FROM consents
      WHERE tenant_id = app_tenant_id() AND contact_id = ${loserId}::uuid`);

    const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
    const mergedPhones = unique([...survivor.phones, ...loser.phones]);
    const mergedEmails = unique([...survivor.emails, ...loser.emails]);
    const mergedTags = unique([...survivor.tags, ...loser.tags]);
    const mergedCustom = {
      ...(loser.custom as Record<string, unknown>),
      ...(survivor.custom as Record<string, unknown>)
    };
    const [after] = await tx
      .update(contacts)
      .set({
        firstName: survivor.firstName || loser.firstName,
        lastName: survivor.lastName ?? loser.lastName,
        companyId: survivor.companyId ?? loser.companyId,
        phones: mergedPhones,
        emails: mergedEmails,
        primaryPhoneE164: survivor.primaryPhoneE164 ?? loser.primaryPhoneE164,
        primaryEmail: survivor.primaryEmail ?? loser.primaryEmail,
        address: Object.keys(survivor.address as object).length ? survivor.address : loser.address,
        timezone: survivor.timezone ?? loser.timezone,
        source: survivor.source ?? loser.source,
        tags: mergedTags,
        ownerId: survivor.ownerId ?? loser.ownerId,
        custom: mergedCustom,
        updatedAt: sql`now()` as unknown as string
      })
      .where(eq(contacts.id, survivorId))
      .returning();

    await tx
      .update(contacts)
      .set({
        mergedIntoId: survivorId,
        deletedAt: sql`now()` as unknown as string,
        updatedAt: sql`now()` as unknown as string
      })
      .where(eq(contacts.id, loserId));
    await audit(tx, {
      action: 'contact.merge',
      entity: 'contact',
      entityId: survivorId,
      before: { survivorId, loserId },
      after: { survivorId, loserId, moved: true }
    });
    await emitEvent(tx, {
      name: 'contact.merged',
      tenantId: after.tenantId,
      actor: actorOf(ctx),
      payload: { survivorId, loserId }
    });
    return after;
  });
}
