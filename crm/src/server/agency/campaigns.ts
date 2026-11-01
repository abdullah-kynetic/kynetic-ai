import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { agencyCallAttempts, agencyCampaignLeads, agencyCampaigns, contacts } from '../db/schema';
import { AppError } from '../errors';
import type { StaffCaller } from '../admin/users';
import { parseInput } from '../validation';
import { inAgency } from './index';
const campaignSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  script: z.string().trim().min(1).max(5000)
});
export async function createAgencyCampaign(
  caller: StaffCaller,
  raw: unknown,
  opts: { db?: Db } = {}
) {
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const input = parseInput(campaignSchema, raw);
      const [created] = await tx
        .insert(agencyCampaigns)
        .values({ tenantId, ...input, createdBy: caller.id })
        .onConflictDoNothing()
        .returning();
      if (!created)
        throw new AppError('CONFLICT', { message: 'A campaign with that name already exists.' });
      await audit(tx, {
        action: 'agency.campaign.create',
        entity: 'campaign',
        entityId: created.id
      });
      return created;
    },
    opts
  );
}
export async function assignAgencyCampaign(
  caller: StaffCaller,
  campaignId: string,
  contactId: string,
  opts: { db?: Db } = {}
) {
  return inAgency(
    caller,
    async (tx, tenantId) => {
      parseInput(z.uuid(), campaignId);
      parseInput(z.uuid(), contactId);
      const [campaign] = await tx
        .select()
        .from(agencyCampaigns)
        .where(eq(agencyCampaigns.id, campaignId))
        .limit(1);
      const [contact] = await tx
        .select({ id: contacts.id, source: contacts.source })
        .from(contacts)
        .where(
          and(eq(contacts.id, contactId), isNull(contacts.deletedAt), isNull(contacts.mergedIntoId))
        )
        .limit(1);
      if (!campaign || !contact) throw new AppError('NOT_FOUND');
      if (!contact.source?.startsWith('agency_')) throw new AppError('CONFLICT');
      const added = await tx
        .insert(agencyCampaignLeads)
        .values({ tenantId, campaignId, contactId })
        .onConflictDoNothing()
        .returning();
      if (added.length)
        await audit(tx, {
          action: 'agency.campaign.assign',
          entity: 'campaign',
          entityId: campaignId,
          after: { contactId }
        });
    },
    opts
  );
}
export async function listAgencyCampaigns(caller: StaffCaller, opts: { db?: Db } = {}) {
  return inAgency(
    caller,
    async (tx) => {
      const campaigns = await tx
        .select()
        .from(agencyCampaigns)
        .orderBy(desc(agencyCampaigns.createdAt), agencyCampaigns.id);
      const memberships = await tx
        .select()
        .from(agencyCampaignLeads)
        .innerJoin(contacts, eq(contacts.id, agencyCampaignLeads.contactId))
        .where(and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)));
      const ids = memberships.map((m) => m.contacts.id);
      const attempts = ids.length
        ? await tx
            .select()
            .from(agencyCallAttempts)
            .where(inArray(agencyCallAttempts.contactId, ids))
        : [];
      return campaigns.map((c) => {
        const members = new Set(
          memberships
            .filter((m) => m.agency_campaign_leads.campaignId === c.id)
            .map((m) => m.contacts.id)
        );
        const logs = attempts.filter((a) => members.has(a.contactId));
        const outcomes: Record<string, number> = {};
        for (const log of logs) outcomes[log.outcome] = (outcomes[log.outcome] ?? 0) + 1;
        return { ...c, assigned: members.size, logged: logs.length, outcomes };
      });
    },
    opts
  );
}
