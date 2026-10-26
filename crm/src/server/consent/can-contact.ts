import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { activities, consents, contacts, dncEntries, tenants } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import {
  checkWindow,
  DEFAULT_WINDOW,
  intersect,
  isValidTimeZone,
  type QuietWindow
} from './quiet-hours';
import { run } from './run';
import type { ConsentChannel, ConsentRunOpts, ContactDecision, DenyReason } from './types';

export type CanContactOpts = ConsentRunOpts & {
  purpose?: string;
  /** Per-state windows layered on the default (SECURITY 3.4), keyed by two-letter state. Content needs counsel. */
  stateWindows?: Record<string, QuietWindow>;
  /** Skip the activities row, e.g. for an audience preview that sends nothing. */
  audit?: boolean;
};

/** Opt-outs the contact made themselves read as `opted_out`; anything else is a revoke by staff. */
const SELF_OPT_OUT_SOURCES = ['sms_keyword', 'call', 'email_link'];
const PHONE_CHANNELS: ConsentChannel[] = ['phone_call', 'sms'];

/**
 * The compliance gate's consent half (SECURITY 3.1, DC-042): may this tenant contact this person on
 * this channel right now? The tenant comes from `ctx`; the contact is loaded inside. Module, pause,
 * kill-switch, A2P and cap checks belong to OutboundGate, which calls this.
 *
 * Order matters. Final denials (DNC, revoked, no consent) come before quiet hours, which are the
 * only deferrable denial and carry `retryAt`. Every decision writes an activities row.
 */
export async function canContact(
  ctx: TenantContextInput,
  contactId: string,
  channel: ConsentChannel,
  now: Date,
  opts: CanContactOpts = {}
): Promise<ContactDecision> {
  return run(ctx, opts, async (tx) => {
    const { decision, found } = await decide(tx, ctx.tenantId, contactId, channel, now, opts);
    // A contact this tenant cannot see has nothing to hang an activity on.
    if (opts.audit !== false && !ctx.readOnly && found) {
      await tx.insert(activities).values({
        tenantId: ctx.tenantId,
        contactId,
        type: 'system',
        summary: decision.allowed
          ? `contact allowed: ${channel}`
          : `blocked: ${decision.reason} (${channel})`,
        actorType: 'system',
        occurredAt: now.toISOString(),
        meta: {
          check: 'can_contact',
          channel,
          purpose: opts.purpose ?? null,
          allowed: decision.allowed,
          reason: decision.allowed ? null : decision.reason,
          retryAt: !decision.allowed && decision.retryAt ? decision.retryAt.toISOString() : null
        }
      });
    }
    return decision;
  });
}

const deny = (reason: DenyReason, retryAt?: Date): ContactDecision => ({
  allowed: false,
  reason,
  ...(retryAt ? { retryAt } : {})
});

async function decide(
  tx: Tx,
  tenantId: string,
  contactId: string,
  channel: ConsentChannel,
  now: Date,
  opts: CanContactOpts
): Promise<{ decision: ContactDecision; found: boolean }> {
  const [contact] = await tx
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.id, contactId), isNull(contacts.deletedAt), isNull(contacts.mergedIntoId))
    )
    .limit(1);
  // Another tenant's contact is invisible under RLS, so it reads as having no consent.
  if (!contact) return { decision: deny('no_consent'), found: false };
  return { decision: await decideFor(tx, tenantId, contact, channel, now, opts), found: true };
}

async function decideFor(
  tx: Tx,
  tenantId: string,
  contact: typeof contacts.$inferSelect,
  channel: ConsentChannel,
  now: Date,
  opts: CanContactOpts
): Promise<ContactDecision> {
  const contactId = contact.id;

  if (PHONE_CHANNELS.includes(channel)) {
    const numbers = [contact.primaryPhoneE164, ...contact.phones].filter((p): p is string => !!p);
    const listed = numbers.length
      ? await tx
          .select({ id: dncEntries.id })
          .from(dncEntries)
          .where(and(inArray(dncEntries.e164, numbers), isNull(dncEntries.removedAt)))
          .limit(1)
      : [];
    if (contact.doNotCallAt || listed.length) return deny('internal_dnc');
  }

  const recent = await tx
    .select()
    .from(consents)
    .where(and(eq(consents.contactId, contactId), eq(consents.channel, channel)))
    .orderBy(desc(consents.capturedAt))
    .limit(20);
  // Rows sharing the newest timestamp are one event; the most restrictive wins.
  const newest = recent.filter((r) => r.capturedAt === recent[0]?.capturedAt);
  const current =
    newest.find((r) => r.kind === 'dnc') ?? newest.find((r) => r.kind === 'opt_out') ?? newest[0];
  if (!current) return deny('no_consent');
  if (current.kind === 'dnc') return deny('internal_dnc');
  if (current.kind === 'opt_out') {
    return deny(SELF_OPT_OUT_SOURCES.includes(current.source) ? 'opted_out' : 'consent_revoked');
  }
  if (current.revokedAt) return deny('consent_revoked');

  if (PHONE_CHANNELS.includes(channel)) {
    const [tenant] = await tx
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    // Contact zone first, then the tenant's (ZIP and area-code lookups are not built yet).
    const tz = [contact.timezone, tenant?.timezone].find(isValidTimeZone);
    if (!tz) return deny('unknown_timezone');

    const state = (contact.address as { state?: unknown } | null)?.state;
    const stateWindow =
      typeof state === 'string' ? opts.stateWindows?.[state.toUpperCase()] : undefined;
    const window = stateWindow ? intersect(DEFAULT_WINDOW, stateWindow) : DEFAULT_WINDOW;
    const check = checkWindow(now, tz, window);
    if (!check.open) return deny('quiet_hours', check.nextOpen);
  }

  return { allowed: true };
}
