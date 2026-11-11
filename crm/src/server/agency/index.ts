import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { SYNTHETIC_PHONE, US_STATE_CODES } from './dialer-policy';
import { z } from 'zod';
import { scheduleAgencyDigest } from './ops';
import { emitEvent } from '../events';
import { scheduleAgencyMaintenance } from './scheduling';
import { getDb, type Db, type Tx } from '../db/client';
import { contacts, dealContacts, deals, pipelineStages, pipelines } from '../db/schema';
import { createContact } from '../contacts';
import { createDeal, moveDeal, updateStage } from '../deals';
import { parseInput } from '../validation';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { withPlatform, withTenant } from '../tenancy';
import type { StaffCaller } from '../admin/users';

export type AgencyWorkspace = { tenantId: string; name: string; slug: string; created: boolean };
export const AGENCY_STAGES = [
  'New',
  'Contacted',
  'Interested',
  'Proposal Sent',
  'Won',
  'Lost',
  'Nurture'
] as const;

/** Existing staff guard supplies the caller; the database independently rechecks active admin role. */
export async function getAgencyWorkspace(
  caller: StaffCaller,
  create = false,
  opts: { db?: Db; scheduleJobs?: boolean } = {}
): Promise<AgencyWorkspace | null> {
  if (caller.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
  try {
    const rows = await withPlatform(
      { userId: caller.id, role: 'admin' },
      (tx) =>
        tx.execute<{ tenant_id: string; name: string; slug: string; created: boolean }>(
          sql`select * from admin_agency_workspace(${create})`
        ),
      opts
    );
    const row = rows[0];
    if (row && create && opts.scheduleJobs !== false) {
      await scheduleAgencyMaintenance(row.tenant_id);
      await scheduleAgencyDigest(row.tenant_id, caller.id);
    }
    return row
      ? { tenantId: row.tenant_id, name: row.name, slug: row.slug, created: row.created }
      : null;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    const code = e.cause?.code ?? e.code;
    if (code === '42501') throw new AppError('FORBIDDEN');
    if (code === '23505') throw new AppError('CONFLICT');
    throw error;
  }
}

export async function inAgency<T>(
  caller: StaffCaller,
  fn: (tx: Tx, tenantId: string) => Promise<T>,
  opts: { db?: Db } = {}
): Promise<T> {
  const db = opts.db ?? getDb();
  const workspace = await getAgencyWorkspace(caller, false, { db });
  if (!workspace) throw new AppError('NOT_FOUND');
  return withTenant(
    { tenantId: workspace.tenantId, userId: caller.id, role: 'admin' },
    async (tx) => {
      await requireModule({ tenantId: workspace.tenantId, role: 'admin' }, 'crm', {
        level: 'full',
        tx
      });
      return fn(tx, workspace.tenantId);
    },
    { db }
  );
}

export async function getAgencyPipeline(caller: StaffCaller, opts: { db?: Db } = {}) {
  return inAgency(
    caller,
    async (tx) => {
      const [pipeline] = await tx
        .select()
        .from(pipelines)
        .where(eq(pipelines.isDefault, true))
        .limit(1);
      if (!pipeline) throw new AppError('NOT_FOUND');
      const stages = await tx
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, pipeline.id))
        .orderBy(pipelineStages.position);
      return { pipeline, stages };
    },
    opts
  );
}

export const syntheticLeadSchema = z
  .strictObject({
    firstName: z.string().trim().min(1).max(200),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase())
      .refine((v) => v.endsWith('@example.test')),
    phone: z.string().regex(SYNTHETIC_PHONE).optional(),
    state: z
      .enum(US_STATE_CODES as [string, ...string[]])
      .refine((value) => !['FL', 'OK'].includes(value), 'unsupported_business_state')
      .optional(),
    direction: z.enum(['inbound', 'outbound']),
    channel: z.enum(['form', 'booking', 'referral', 'other', 'cold_call', 'sms', 'email', 'dm'])
  })
  .superRefine((v, ctx) => {
    const outbound = ['cold_call'].includes(v.channel);
    const inbound = ['form', 'booking', 'referral', 'other'].includes(v.channel);
    if ((outbound && v.direction !== 'outbound') || (inbound && v.direction !== 'inbound'))
      ctx.addIssue({ code: 'custom', path: ['channel'], message: 'direction_channel_mismatch' });
  });

export const AGENCY_SOURCES = [
  ['inbound', 'form'],
  ['inbound', 'booking'],
  ['inbound', 'referral'],
  ['inbound', 'other'],
  ['inbound', 'sms'],
  ['inbound', 'email'],
  ['inbound', 'dm'],
  ['outbound', 'cold_call'],
  ['outbound', 'sms'],
  ['outbound', 'email'],
  ['outbound', 'dm']
] as const;
const sourceKey = (direction: string, channel: string) => `agency_${direction}_${channel}`;

export async function createAgencyLead(caller: StaffCaller, raw: unknown, opts: { db?: Db } = {}) {
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const input = parseInput(syntheticLeadSchema, raw);
      const ctx = { tenantId, userId: caller.id, role: 'admin' as const };
      // Use the contact service, never createManualLead: human outbound lists must not trigger outreach.
      const contact = await createContact(
        ctx,
        {
          firstName: input.firstName,
          phones: input.phone ? [input.phone] : [],
          address: input.state ? { state: input.state } : {},
          emails: [input.email],
          source: sourceKey(input.direction, input.channel)
        },
        { tx, asLead: false }
      );
      const deal = await createDeal(
        ctx,
        { title: input.firstName, contactId: contact.id, source: contact.source ?? undefined },
        { tx }
      );
      await tx.execute(sql`insert into agency_alerts (tenant_id,kind,title,body,event_key)
        values (${tenantId},'new_lead','New agency lead','A prospect was added to the agency pipeline.',${`lead/${contact.id}`})`);
      await emitEvent(tx, {
        name: 'agency.lead.created',
        tenantId,
        actor: { type: 'user', id: caller.id },
        payload: { contactId: contact.id, dealId: deal.id }
      });
      return { contactId: contact.id, dealId: deal.id };
    },
    opts
  );
}

const filtersSchema = z.strictObject({
  direction: z.enum(['inbound', 'outbound']).optional(),
  channel: z
    .enum(['form', 'booking', 'referral', 'other', 'cold_call', 'sms', 'email', 'dm'])
    .optional(),
  stageId: z.uuid().optional()
});
export async function listAgencyLeads(
  caller: StaffCaller,
  raw: unknown = {},
  opts: { db?: Db } = {}
) {
  return inAgency(
    caller,
    async (tx) => {
      const filter = parseInput(filtersSchema, raw);
      const keys = AGENCY_SOURCES.filter(
        ([d, c]) =>
          (!filter.direction || d === filter.direction) && (!filter.channel || c === filter.channel)
      ).map(([d, c]) => sourceKey(d, c));
      const rows = keys.length
        ? await tx
            .select({
              id: contacts.id,
              firstName: contacts.firstName,
              email: contacts.primaryEmail,
              source: contacts.source,
              state: sql<string | null>`nullif(${contacts.address} ->> 'state', '')`
            })
            .from(contacts)
            .where(
              and(
                inArray(contacts.source, keys),
                isNull(contacts.deletedAt),
                isNull(contacts.mergedIntoId)
              )
            )
            .orderBy(desc(contacts.createdAt), contacts.id)
            .limit(50)
        : [];
      const grouped = await tx
        .select({ source: contacts.source, count: count() })
        .from(contacts)
        .where(and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)))
        .groupBy(contacts.source);
      const linked = rows.length
        ? await tx
            .select({
              contactId: dealContacts.contactId,
              dealId: deals.id,
              stageId: deals.stageId,
              stageName: pipelineStages.name,
              lostReason: deals.lostReason
            })
            .from(dealContacts)
            .innerJoin(deals, eq(deals.id, dealContacts.dealId))
            .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
            .where(
              and(
                inArray(
                  dealContacts.contactId,
                  rows.map((r) => r.id)
                ),
                isNull(deals.deletedAt),
                filter.stageId ? eq(deals.stageId, filter.stageId) : undefined
              )
            )
            .orderBy(deals.createdAt, deals.id)
        : [];
      const leadRows = rows
        .map((r) => ({ ...r, deal: linked.find((d) => d.contactId === r.id) ?? null }))
        .filter((r) => !filter.stageId || r.deal);
      return {
        leads: leadRows,
        counts: AGENCY_SOURCES.map(([direction, channel]) => ({
          direction,
          channel,
          count: grouped.find((g) => g.source === sourceKey(direction, channel))?.count ?? 0
        }))
      };
    },
    opts
  );
}

export async function renameAgencyStage(
  caller: StaffCaller,
  stageId: string,
  name: string,
  opts: { db?: Db } = {}
) {
  return inAgency(
    caller,
    (tx, tenantId) =>
      updateStage(
        { tenantId, userId: caller.id, role: 'admin' },
        { userId: caller.id, kyneticRole: 'admin', membership: null, viewAs: null },
        stageId,
        { name },
        { tx }
      ),
    opts
  );
}
export async function moveAgencyDeal(
  caller: StaffCaller,
  dealId: string,
  stageId: string,
  opts: { db?: Db; lostReason?: string } = {}
) {
  return inAgency(
    caller,
    (tx, tenantId) =>
      moveDeal(
        { tenantId, userId: caller.id, role: 'admin' },
        dealId,
        { stageId, ...(opts.lostReason ? { lostReason: opts.lostReason } : {}) },
        { tx }
      ),
    opts
  );
}

export async function listAgencyAlerts(caller: StaffCaller, opts: { db?: Db } = {}) {
  return inAgency(
    caller,
    async (tx) =>
      Array.from(
        await tx.execute<{
          id: string;
          kind: string;
          title: string;
          body: string;
          created_at: string;
        }>(
          sql`select id,kind,title,body,created_at from agency_alerts order by created_at desc,id desc limit 30`
        )
      ),
    opts
  );
}
