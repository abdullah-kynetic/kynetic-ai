import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { inAgency } from '../agency';
import { renderProposalPdf } from './pdf';
import type { StaffCaller } from '../admin/users';
import { audit } from '../audit';
import type { Db, Tx } from '../db/client';
import { agencyProposals, deals } from '../db/schema';
import { AppError } from '../errors';
import { parseInput } from '../validation';

export const PROPOSAL_SECTIONS = [
  { key: 'problem', title: 'Problem' },
  { key: 'solution', title: 'Agentic Solution' },
  { key: 'roadmap', title: 'Roadmap' },
  { key: 'roi', title: 'ROI' }
] as const;
const section = z.string().max(6000);
export const proposalSaveSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  problem: section,
  solution: section,
  roadmap: section,
  roi: section,
  expectedRevision: z.number().int().min(1).max(2_000_000_000)
});
type Options = { db?: Db; now?: Date };
async function liveDeal(tx: Tx, dealId: string) {
  const [deal] = await tx
    .select({ id: deals.id, title: deals.title })
    .from(deals)
    .where(and(eq(deals.id, dealId), isNull(deals.deletedAt)))
    .limit(1);
  if (!deal) throw new AppError('NOT_FOUND');
  return deal;
}

/** One working draft per deal; opening/creating again preserves any existing edits. */
export async function openAgencyProposal(caller: StaffCaller, dealId: string, opts: Options = {}) {
  return inAgency(
    caller,
    async (tx, tenantId) => {
      parseInput(z.uuid(), dealId);
      const deal = await liveDeal(tx, dealId);
      const [created] = await tx
        .insert(agencyProposals)
        .values({
          tenantId,
          dealId,
          title: `${deal.title} proposal`.slice(0, 200),
          createdBy: caller.id,
          updatedBy: caller.id
        })
        .onConflictDoNothing({ target: [agencyProposals.tenantId, agencyProposals.dealId] })
        .returning();
      if (created) {
        await audit(tx, {
          action: 'agency.proposal.create',
          entity: 'proposal',
          entityId: created.id,
          after: { dealId, revision: 1 }
        });
        return created;
      }
      const [existing] = await tx
        .select()
        .from(agencyProposals)
        .where(eq(agencyProposals.dealId, dealId))
        .limit(1);
      if (!existing) throw new AppError('CONFLICT');
      return existing;
    },
    opts
  );
}
export async function getAgencyProposal(caller: StaffCaller, id: string, opts: Options = {}) {
  return inAgency(
    caller,
    async (tx) => {
      parseInput(z.uuid(), id);
      const [row] = await tx
        .select({ proposal: agencyProposals, dealTitle: deals.title })
        .from(agencyProposals)
        .innerJoin(deals, eq(deals.id, agencyProposals.dealId))
        .where(and(eq(agencyProposals.id, id), isNull(deals.deletedAt)))
        .limit(1);
      if (!row) throw new AppError('NOT_FOUND');
      return row;
    },
    opts
  );
}
export async function listAgencyProposals(caller: StaffCaller, opts: Options = {}) {
  return inAgency(
    caller,
    (tx) =>
      tx
        .select({
          id: agencyProposals.id,
          title: agencyProposals.title,
          dealTitle: deals.title,
          updatedAt: agencyProposals.updatedAt
        })
        .from(agencyProposals)
        .innerJoin(deals, eq(deals.id, agencyProposals.dealId))
        .where(isNull(deals.deletedAt))
        .orderBy(desc(agencyProposals.updatedAt), agencyProposals.id)
        .limit(50),
    opts
  );
}
export async function listProposalDeals(caller: StaffCaller, opts: Options = {}) {
  return inAgency(
    caller,
    (tx) =>
      tx
        .select({ id: deals.id, title: deals.title })
        .from(deals)
        .where(isNull(deals.deletedAt))
        .orderBy(desc(deals.createdAt), deals.id)
        .limit(50),
    opts
  );
}
export async function saveAgencyProposal(
  caller: StaffCaller,
  id: string,
  raw: unknown,
  opts: Options = {}
) {
  return inAgency(
    caller,
    async (tx) => {
      parseInput(z.uuid(), id);
      const input = parseInput(proposalSaveSchema, raw);
      const [before] = await tx
        .select()
        .from(agencyProposals)
        .where(eq(agencyProposals.id, id))
        .for('update');
      if (!before) throw new AppError('NOT_FOUND');
      await liveDeal(tx, before.dealId);
      const { expectedRevision, ...content } = input;
      const keys = ['title', 'problem', 'solution', 'roadmap', 'roi'] as const;
      const changed = keys.filter((key) => before[key] !== content[key]);
      // A lost-response retry of identical content is safe even after its first save advanced revision.
      if (!changed.length) return before;
      if (before.revision !== expectedRevision)
        throw new AppError('CONFLICT', {
          message: 'A newer draft exists. Your edits were not applied.'
        });
      const [after] = await tx
        .update(agencyProposals)
        .set({
          ...content,
          revision: before.revision + 1,
          updatedBy: caller.id,
          updatedAt: (opts.now ?? new Date()).toISOString()
        })
        .where(eq(agencyProposals.id, id))
        .returning();
      await audit(tx, {
        action: 'agency.proposal.update',
        entity: 'proposal',
        entityId: id,
        before: { revision: before.revision },
        after: { revision: after!.revision, changed }
      });
      return after!;
    },
    opts
  );
}

export async function exportAgencyProposal(caller: StaffCaller, id: string, opts: Options = {}) {
  const data = await getAgencyProposal(caller, id, opts);
  const bytes = await renderProposalPdf({
    title: data.proposal.title,
    dealTitle: data.dealTitle,
    problem: data.proposal.problem,
    solution: data.proposal.solution,
    roadmap: data.proposal.roadmap,
    roi: data.proposal.roi
  });
  await inAgency(
    caller,
    (tx) =>
      audit(tx, {
        action: 'agency.proposal.export',
        entity: 'proposal',
        entityId: id,
        after: { bytes: bytes.byteLength }
      }),
    opts
  );
  return bytes;
}
