import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { consents, contacts, dncEntries } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { run } from './run';
import { CONSENT_CHANNELS, type ConsentRunOpts } from './types';

const e164 = z.string().regex(/^\+[1-9][0-9]{7,14}$/);

const recordInput = z
  .object({
    contactId: z.uuid(),
    channel: z.enum(CONSENT_CHANNELS),
    source: z.string().min(1),
    capturedText: z.string().min(1).optional(),
    wordingVersion: z.string().min(1).optional(),
    ip: z.string().optional(),
    capturedAt: z.date().optional()
  })
  // Manual entry needs a free-text basis (SECURITY 3.2). Form leads carry the wording they saw.
  .refine((v) => !['staff', 'form'].includes(v.source) || !!v.capturedText, {
    message: 'capturedText is required for staff and form consent',
    path: ['capturedText']
  });
export type RecordConsentInput = z.input<typeof recordInput>;

/** Appends an express-written consent row. Rows are never edited; new consent is a new row. */
export async function recordConsent(
  ctx: TenantContextInput,
  input: RecordConsentInput,
  opts: ConsentRunOpts = {}
) {
  const v = recordInput.parse(input);
  return run(ctx, opts, async (tx) => {
    const [row] = await tx
      .insert(consents)
      .values({
        tenantId: ctx.tenantId,
        contactId: v.contactId,
        channel: v.channel,
        kind: 'express_written',
        source: v.source,
        capturedText: v.capturedText,
        wordingVersion: v.wordingVersion,
        ip: v.ip,
        capturedAt: v.capturedAt?.toISOString()
      })
      .returning();
    return row;
  });
}

const revokeInput = z.object({
  contactId: z.uuid(),
  channel: z.enum(CONSENT_CHANNELS),
  /** `sms_keyword`, `call` and `email_link` are the contact's own opt-out; anything else is a staff revoke. */
  source: z.string().min(1),
  capturedText: z.string().min(1).optional(),
  capturedAt: z.date().optional()
});
export type RevokeConsentInput = z.input<typeof revokeInput>;

/**
 * Revokes consent for one channel by appending an `opt_out` row. The runtime has no UPDATE grant on
 * `consents` (DATABASE.md), so the old grant stays as evidence and the newer row wins.
 */
export async function revokeConsent(
  ctx: TenantContextInput,
  input: RevokeConsentInput,
  opts: ConsentRunOpts = {}
) {
  const v = revokeInput.parse(input);
  return run(ctx, opts, async (tx) => {
    const [row] = await tx
      .insert(consents)
      .values({
        tenantId: ctx.tenantId,
        contactId: v.contactId,
        channel: v.channel,
        kind: 'opt_out',
        source: v.source,
        capturedText: v.capturedText,
        capturedAt: v.capturedAt?.toISOString()
      })
      .returning();
    return row;
  });
}

const dncInput = z.object({
  e164,
  contactId: z.uuid().optional(),
  /** `opt_out`, `import` or `staff` (DATABASE.md). */
  source: z.string().min(1),
  capturedAt: z.date().optional()
});
export type AddDncInput = z.input<typeof dncInput>;

/**
 * Adds a number to the tenant's internal DNC list. With a contact, it also blocks the contact
 * itself: `dnc` consent rows for calls and texts, and `contacts.do_not_call_at` (SECURITY 3.3).
 * Adding a number already on the list is a no-op.
 */
export async function addDncEntry(
  ctx: TenantContextInput,
  input: AddDncInput,
  opts: ConsentRunOpts = {}
) {
  const v = dncInput.parse(input);
  return run(ctx, opts, async (tx) => {
    const at = (v.capturedAt ?? new Date()).toISOString();
    await tx
      .insert(dncEntries)
      .values({
        tenantId: ctx.tenantId,
        e164: v.e164,
        contactId: v.contactId,
        source: v.source,
        addedAt: at
      })
      .onConflictDoNothing({
        target: [dncEntries.tenantId, dncEntries.e164],
        where: isNull(dncEntries.removedAt)
      });
    if (v.contactId) {
      await tx.insert(consents).values(
        (['phone_call', 'sms'] as const).map((channel) => ({
          tenantId: ctx.tenantId,
          contactId: v.contactId as string,
          channel,
          kind: 'dnc',
          source: v.source,
          capturedAt: at
        }))
      );
      await tx
        .update(contacts)
        .set({ doNotCallAt: at, updatedAt: sql`now()` })
        .where(and(eq(contacts.id, v.contactId), isNull(contacts.doNotCallAt)));
    }
  });
}
