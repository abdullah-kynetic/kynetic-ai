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
  pipelineStages,
  tasks
} from '../db/schema';
import { pacificDateTimeToUtc } from './pacific-time';
import { AppError, ValidationError } from '../errors';
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
const CALLBACK_TASK = 'Scheduled callback';
const outcomeSchema = z
  .strictObject({
    eventId: z.uuid(),
    contactId: z.uuid(),
    outcome: z.enum(HUMAN_CALL_OUTCOMES),
    notes: z.string().trim().max(1000).default(''),
    callbackDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    callbackTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
  })
  .superRefine((value, ctx) => {
    if (value.outcome === 'callback' && (!value.callbackDate || !value.callbackTime))
      ctx.addIssue({ code: 'custom', path: ['callbackDate'], message: 'callback_required' });
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
      const now = opts.now ?? new Date();
      const dueTasks = await tx
        .select({ contactId: tasks.contactId, dueAt: tasks.dueAt })
        .from(tasks)
        .where(
          and(
            eq(tasks.title, CALLBACK_TASK),
            isNull(tasks.completedAt),
            isNull(tasks.deletedAt),
            sql`${tasks.dueAt} <= ${now.toISOString()}`
          )
        )
        .orderBy(tasks.dueAt, tasks.id);
      const byId = new Map(rows.map((row) => [row.id, row]));
      const callbacks = dueTasks.flatMap((task) => {
        if (!task.contactId) return [];
        const contact = byId.get(task.contactId);
        if (!contact || guard.closed.has(contact.id)) return [];
        if (dialerBlockReason(contact, guard.numbers, guard.optedOut.has(contact.id))) return [];
        return [contact];
      });
      const seen = new Set<string>();
      const queue = [...callbacks, ...available].filter((contact) => {
        if (seen.has(contact.id)) return false;
        seen.add(contact.id);
        return true;
      });
      const callbackIds = new Set(callbacks.map((contact) => contact.id));
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
        next: queue[0]
          ? {
              id: queue[0].id,
              name: queue[0].firstName,
              phone: queue[0].primaryPhoneE164,
              callbackDue: callbackIds.has(queue[0].id)
            }
          : null,
        remaining: queue.length,
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
      const now = opts.now ?? new Date();
      const [already] = await tx
        .select({ id: agencyCallAttempts.id })
        .from(agencyCallAttempts)
        .where(eq(agencyCallAttempts.contactId, contact.id))
        .limit(1);
      const [dueCallback] = already
        ? await tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(
              and(
                eq(tasks.contactId, contact.id),
                eq(tasks.title, CALLBACK_TASK),
                isNull(tasks.completedAt),
                isNull(tasks.deletedAt),
                sql`${tasks.dueAt} <= ${now.toISOString()}`
              )
            )
            .limit(1)
        : [];
      if (already && !dueCallback) throw new AppError('CONFLICT');
      let callbackDue: string | null = null;
      if (input.outcome === 'callback') {
        try {
          callbackDue = pacificDateTimeToUtc(input.callbackDate!, input.callbackTime!);
        } catch {
          throw new ValidationError({ callbackDate: ['invalid'] });
        }
      }
      if (dueCallback)
        await tx
          .update(tasks)
          .set({ completedAt: now.toISOString(), completedBy: caller.id })
          .where(
            and(
              eq(tasks.contactId, contact.id),
              eq(tasks.title, CALLBACK_TASK),
              isNull(tasks.completedAt),
              isNull(tasks.deletedAt)
            )
          );
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
          loggedAt: now.toISOString()
        })
        .returning({ id: agencyCallAttempts.id });
      if (callbackDue) {
        const [task] = await tx
          .insert(tasks)
          .values({
            tenantId,
            title: CALLBACK_TASK,
            dueAt: callbackDue,
            contactId: contact.id,
            assigneeId: null,
            priority: 'high',
            createdBy: caller.id
          })
          .returning({ id: tasks.id });
        await audit(tx, {
          action: 'agency.callback.schedule',
          entity: 'task',
          entityId: task!.id,
          after: { contactId: contact.id, dueAt: callbackDue }
        });
      }
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
