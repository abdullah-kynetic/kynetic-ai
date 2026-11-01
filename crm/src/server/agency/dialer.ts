import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { recordActivity } from '../activity';
import { audit } from '../audit';
import { addDncEntry } from '../consent';
import type { Db, Tx } from '../db/client';
import {
  agencyCallAttempts,
  agencyCampaignLeads,
  agencyCampaigns,
  companies,
  consents,
  contacts,
  dealContacts,
  deals,
  dncEntries,
  pipelineStages
} from '../db/schema';
import { AppError } from '../errors';
import type { StaffCaller } from '../admin/users';
import { parseInput } from '../validation';
import { inAgency } from './index';
import { DEFAULT_DIALER_SCRIPT, dialerBlockReason } from './dialer-policy';

export const HUMAN_CALL_OUTCOMES = [
  'no_answer',
  'voicemail',
  'connected',
  'interested',
  'not_interested',
  'callback',
  'dnc'
] as const;
const outcomeSchema = z.strictObject({
  eventId: z.uuid(),
  contactId: z.uuid(),
  outcome: z.enum(HUMAN_CALL_OUTCOMES),
  notes: z.string().trim().max(1000).default('')
});
type Options = { db?: Db; now?: Date };
async function candidates(tx: Tx, contactId?: string) {
  return tx
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      companyName: companies.name,
      primaryPhoneE164: contacts.primaryPhoneE164,
      phones: contacts.phones,
      address: contacts.address,
      source: contacts.source,
      doNotCallAt: contacts.doNotCallAt
    })
    .from(contacts)
    .leftJoin(companies, eq(companies.id, contacts.companyId))
    .where(
      and(
        contactId ? eq(contacts.id, contactId) : eq(contacts.source, 'agency_outbound_cold_call'),
        isNull(contacts.deletedAt),
        isNull(contacts.mergedIntoId)
      )
    )
    .orderBy(contacts.createdAt, contacts.id);
}
async function guardData(tx: Tx, ids: string[]) {
  const numbers = await tx
    .select({ number: dncEntries.e164 })
    .from(dncEntries)
    .where(isNull(dncEntries.removedAt));
  const rows = ids.length
    ? await tx
        .select({
          contactId: consents.contactId,
          kind: consents.kind,
          revokedAt: consents.revokedAt,
          capturedAt: consents.capturedAt
        })
        .from(consents)
        .where(and(inArray(consents.contactId, ids), eq(consents.channel, 'phone_call')))
        .orderBy(desc(consents.capturedAt))
    : [];
  const optedOut = new Set<string>();
  for (const id of ids) {
    const own = rows.filter((r) => r.contactId === id);
    const newest = own.filter((r) => r.capturedAt === own[0]?.capturedAt);
    if (newest.some((r) => r.kind === 'dnc' || r.kind === 'opt_out' || r.revokedAt))
      optedOut.add(id);
  }
  const closed = ids.length
    ? await tx
        .select({ contactId: dealContacts.contactId })
        .from(dealContacts)
        .innerJoin(deals, eq(deals.id, dealContacts.dealId))
        .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
        .where(
          and(
            inArray(dealContacts.contactId, ids),
            isNull(deals.deletedAt),
            or(eq(pipelineStages.isWon, true), eq(pipelineStages.isLost, true))
          )
        )
    : [];
  return {
    numbers: new Set(numbers.map((r) => r.number)),
    optedOut,
    closed: new Set(closed.map((r) => r.contactId))
  };
}
export async function getAgencyDialer(
  caller: StaffCaller,
  campaignId?: string,
  opts: Options = {}
) {
  return inAgency(
    caller,
    async (tx) => {
      let script = DEFAULT_DIALER_SCRIPT;
      let assigned: Set<string> | null = null;
      if (campaignId) {
        parseInput(z.uuid(), campaignId);
        const [campaign] = await tx
          .select()
          .from(agencyCampaigns)
          .where(eq(agencyCampaigns.id, campaignId))
          .limit(1);
        if (!campaign) throw new AppError('NOT_FOUND');
        script = campaign.script;
        const members = await tx
          .select()
          .from(agencyCampaignLeads)
          .where(eq(agencyCampaignLeads.campaignId, campaignId));
        assigned = new Set(members.map((m) => m.contactId));
      }
      const rows = (await candidates(tx)).filter((r) => !assigned || assigned.has(r.id));
      const guard = await guardData(
        tx,
        rows.map((r) => r.id)
      );
      const attempts = await tx
        .select({ contactId: agencyCallAttempts.contactId })
        .from(agencyCallAttempts);
      const done = new Set(attempts.map((r) => r.contactId));
      const available = rows.filter(
        (r) =>
          !done.has(r.id) &&
          !guard.closed.has(r.id) &&
          !dialerBlockReason(r, guard.numbers, guard.optedOut.has(r.id))
      );
      const history = await tx
        .select({
          id: agencyCallAttempts.id,
          name: contacts.firstName,
          outcome: agencyCallAttempts.outcome,
          loggedAt: agencyCallAttempts.loggedAt
        })
        .from(agencyCallAttempts)
        .innerJoin(contacts, eq(contacts.id, agencyCallAttempts.contactId))
        .orderBy(desc(agencyCallAttempts.loggedAt), agencyCallAttempts.id)
        .limit(10);
      return {
        next: available[0]
          ? {
              id: available[0].id,
              name: available[0].firstName,
              phone: available[0].primaryPhoneE164
            }
          : null,
        remaining: available.length,
        unavailable: rows.length - available.length,
        script,
        history
      };
    },
    opts
  );
}

export async function logAgencyCall(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const input = parseInput(outcomeSchema, raw);
      const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:human-call:${input.eventId}`}, 0))`
      );
      const [prior] = await tx
        .select()
        .from(agencyCallAttempts)
        .where(eq(agencyCallAttempts.eventId, input.eventId))
        .limit(1);
      if (prior) {
        if (prior.requestHash !== hash) throw new AppError('CONFLICT');
        return { id: prior.id, duplicate: true };
      }
      const [locked] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.id, input.contactId))
        .for('update');
      if (!locked) throw new AppError('NOT_FOUND');
      const [contact] = await candidates(tx, input.contactId);
      if (!contact) throw new AppError('NOT_FOUND');
      const guard = await guardData(tx, [contact.id]);
      if (
        guard.closed.has(contact.id) ||
        dialerBlockReason(contact, guard.numbers, guard.optedOut.has(contact.id))
      )
        throw new AppError('CONFLICT', {
          message: 'This lead is no longer available in the dialer.'
        });
      const [already] = await tx
        .select({ id: agencyCallAttempts.id })
        .from(agencyCallAttempts)
        .where(eq(agencyCallAttempts.contactId, contact.id))
        .limit(1);
      if (already) throw new AppError('CONFLICT');
      const [saved] = await tx
        .insert(agencyCallAttempts)
        .values({
          tenantId,
          contactId: contact.id,
          eventId: input.eventId,
          requestHash: hash,
          outcome: input.outcome,
          notes: input.notes,
          loggedBy: caller.id,
          loggedAt: (opts.now ?? new Date()).toISOString()
        })
        .returning({ id: agencyCallAttempts.id });
      if (input.outcome === 'dnc')
        await addDncEntry(
          { tenantId, userId: caller.id, role: 'admin' },
          { e164: contact.primaryPhoneE164!, contactId: contact.id, source: 'staff' },
          { tx }
        );
      await recordActivity(tx, {
        contactId: contact.id,
        type: 'call',
        refTable: 'agency_call_attempts',
        refId: saved!.id,
        summary: `Human call: ${input.outcome.replaceAll('_', ' ')}`,
        actor: { type: 'user', id: caller.id },
        meta: { manual: true, outcome: input.outcome }
      });
      await audit(tx, {
        action: 'agency.call.log',
        entity: 'contact',
        entityId: contact.id,
        after: { outcome: input.outcome, attemptId: saved!.id }
      });
      return { id: saved!.id, duplicate: false };
    },
    opts
  );
}
export async function markAgencyDnc(caller: StaffCaller, contactId: string, opts: Options = {}) {
  return inAgency(
    caller,
    async (tx, tenantId) => {
      parseInput(z.uuid(), contactId);
      const [contact] = await tx
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.id, contactId), isNull(contacts.deletedAt), isNull(contacts.mergedIntoId))
        )
        .for('update');
      if (!contact) throw new AppError('NOT_FOUND');
      if (contact.doNotCallAt) return;
      if (contact.primaryPhoneE164)
        await addDncEntry(
          { tenantId, userId: caller.id, role: 'admin' },
          { e164: contact.primaryPhoneE164, contactId, source: 'staff' },
          { tx }
        );
      else
        await tx
          .update(contacts)
          .set({ doNotCallAt: (opts.now ?? new Date()).toISOString() })
          .where(eq(contacts.id, contactId));
      await recordActivity(tx, {
        contactId,
        type: 'system',
        summary: 'Marked do not call by staff',
        actor: { type: 'user', id: caller.id }
      });
      await audit(tx, { action: 'agency.contact.dnc', entity: 'contact', entityId: contactId });
    },
    opts
  );
}
