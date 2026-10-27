import { and, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { ForbiddenError } from '../auth/errors';
import { can, type Action, type Actor } from '../auth/permissions';
import { contacts } from '../db/schema';
import { isModuleEnabled, requireModule } from '../modules';
import { enrollInSequence, type EnrollResult } from '../outbound/sequences';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { CONTACT_STATUSES } from './constants';
import { uniqueTags } from './schemas';
import {
  deleteContact,
  NotFoundError,
  updateContact,
  type ContactOpts,
  type CreateOpts
} from './service';

function authorize(actor: Actor, action: Action, tenantId: string): void {
  if (!can(actor, action, tenantId)) throw new ForbiddenError();
}

// Bulk actions on the leads list (M1-07; PRD F-08, CRM Full). One call is one transaction: every
// selected contact changes, or none does. Each contact keeps its own audit row and event (so its
// history reads the same as a single edit), and one `contact.bulk.*` row records the whole action.

/** One page of the list is at most 50 rows; the cap leaves room for a future "select all" without
 * letting one request lock an unbounded number of rows. */
export const BULK_MAX_CONTACTS = 200;

const tagSchema = z.string().trim().min(1).max(50);

export const bulkActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('tag'),
    add: z.array(tagSchema).max(20).default([]),
    remove: z.array(tagSchema).max(20).default([])
  }),
  z.strictObject({ type: z.literal('owner'), ownerId: uuidSchema.nullable() }),
  z.strictObject({
    type: z.literal('status'),
    status: z.enum(CONTACT_STATUSES)
  }),
  z.strictObject({ type: z.literal('delete') }),
  z.strictObject({
    type: z.literal('enroll'),
    sequenceKey: z.string().trim().min(1).max(100)
  })
]);

export const bulkContactsSchema = z.strictObject({
  ids: z.array(uuidSchema).min(1).max(BULK_MAX_CONTACTS),
  action: bulkActionSchema
});

export type BulkContactsInput = z.input<typeof bulkContactsSchema>;
export type BulkAction = z.output<typeof bulkActionSchema>;

export type BulkContactsResult = {
  type: BulkAction['type'];
  /** Contacts the action addressed. */
  requested: number;
  /** Contacts that actually changed (an already-tagged contact does not count). */
  changed: number;
  /** Set for `enroll` until the sequence engine ships (M7): nothing was enrolled. */
  enroll?: EnrollResult;
};

/** What the signed-in actor may do in bulk. Both are false when the tenant lacks CRM Full. */
export type BulkCapabilities = {
  edit: boolean;
  delete: boolean;
  enroll: boolean;
};

export async function bulkCapabilities(
  ctx: TenantContextInput,
  actor: Actor,
  opts: Pick<ContactOpts, 'db'> = {}
): Promise<BulkCapabilities> {
  const full = await isModuleEnabled(ctx, 'crm', {
    level: 'full',
    db: opts.db
  });
  if (!full) return { edit: false, delete: false, enroll: false };
  const edit = can(actor, 'bulk.edit', ctx.tenantId);
  return {
    edit,
    delete: can(actor, 'bulk.delete', ctx.tenantId),
    enroll: edit
  };
}

/**
 * Applies one action to up to 200 contacts. Order of checks: CRM Full is on for the tenant
 * (`MODULE_DISABLED`), the actor holds the matrix permission (`FORBIDDEN`; delete needs
 * `bulk.delete`, so staff without the toggle are refused here whatever the UI shows), then input.
 * An id that is not a live contact in this tenant fails the whole call with NOT_FOUND, the same
 * answer for another tenant's id (existence is not leaked).
 */
export async function bulkUpdateContacts(
  ctx: TenantContextInput,
  actor: Actor,
  input: BulkContactsInput,
  opts: CreateOpts = {}
): Promise<BulkContactsResult> {
  await requireModule(ctx, 'crm', { level: 'full', db: opts.db });
  authorize(actor, 'bulk.edit', ctx.tenantId);
  const v = parseInput(bulkContactsSchema, input);
  if (v.action.type === 'delete') authorize(actor, 'bulk.delete', ctx.tenantId);
  const ids = [...new Set(v.ids)];
  const action = v.action;

  const run = (tx: NonNullable<ContactOpts['tx']>) => apply(ctx, ids, action, tx);
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}

async function apply(
  ctx: TenantContextInput,
  ids: string[],
  action: BulkAction,
  tx: NonNullable<ContactOpts['tx']>
): Promise<BulkContactsResult> {
  // Lock in id order so two bulk actions on overlapping rows cannot deadlock.
  const rows = await tx
    .select()
    .from(contacts)
    .where(and(inArray(contacts.id, ids), isNull(contacts.deletedAt)))
    .orderBy(contacts.id)
    .for('update');
  if (rows.length !== ids.length) throw new NotFoundError();

  let changed = 0;
  let enroll: EnrollResult | undefined;

  if (action.type === 'enroll') {
    // The sequence engine is M7-02. The stub reports `not_available`; nothing is written.
    for (const row of rows) {
      enroll = await enrollInSequence(ctx, {
        contactId: row.id,
        sequenceKey: action.sequenceKey
      });
    }
    return { type: 'enroll', requested: ids.length, changed: 0, enroll };
  }

  for (const row of rows) {
    if (action.type === 'delete') {
      await deleteContact(ctx, row.id, { tx });
      changed++;
    } else if (action.type === 'owner') {
      if (row.ownerId === action.ownerId) continue;
      await updateContact(ctx, row.id, { ownerId: action.ownerId }, { tx });
      changed++;
    } else if (action.type === 'status') {
      if (row.status === action.status) continue;
      await updateContact(ctx, row.id, { status: action.status }, { tx });
      changed++;
    } else {
      const drop = new Set(action.remove.map((t) => t.toLowerCase()));
      const next = uniqueTags([
        ...row.tags.filter((t) => !drop.has(t.toLowerCase())),
        ...action.add
      ]);
      if (JSON.stringify(next) === JSON.stringify(row.tags)) continue;
      await updateContact(ctx, row.id, { tags: next }, { tx });
      changed++;
    }
  }

  await audit(tx, {
    action: `contact.bulk.${action.type}`,
    entity: 'contact',
    // Ids and the action's parameters; contact names and phones stay out of the audit row.
    after: { contactIds: ids, changed, ...actionDetail(action) }
  });
  return { type: action.type, requested: ids.length, changed };
}

function actionDetail(action: BulkAction): Record<string, unknown> {
  switch (action.type) {
    case 'tag':
      return { add: action.add, remove: action.remove };
    case 'owner':
      return { ownerId: action.ownerId };
    case 'status':
      return { status: action.status };
    default:
      return {};
  }
}
