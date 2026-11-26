import type { Db } from '../db/client';
import type { StaffCaller } from '../admin/users';
import { getAgencyPipeline, listAgencyLeads, moveAgencyDeal } from './index';
import { AppError } from '../errors';

/**
 * One pipeline for everyone Kynetic is in contact with: Audit pending, Proposal, then the client stages
 * Building, Testing, Live. Deals live in the internal agency workspace until the contract is signed and
 * the deposit is paid; after that the client account carries the stage. People not yet in contact, and
 * people who said no, stay on the Leads tab.
 */
export const PIPELINE_COLUMNS = [
  'audit_pending',
  'proposal',
  'building',
  'testing',
  'live'
] as const;
export type PipelineColumn = (typeof PIPELINE_COLUMNS)[number];

export const COLUMN_LABELS: Record<PipelineColumn, string> = {
  audit_pending: 'Audit pending',
  proposal: 'Proposal',
  building: 'Building',
  testing: 'Testing',
  live: 'Live'
};

/** The stored agency stage names behind the two sales columns. Stored names stay as they are. */
const DEAL_COLUMN: Record<string, PipelineColumn | 'lead' | 'declined' | 'won'> = {
  New: 'lead',
  Contacted: 'audit_pending',
  Interested: 'audit_pending',
  'Proposal Sent': 'proposal',
  Nurture: 'proposal',
  Won: 'won',
  Lost: 'declined'
};
const STORED_STAGE: Record<'audit_pending' | 'proposal', string> = {
  audit_pending: 'Contacted',
  proposal: 'Proposal Sent'
};

export function dealColumn(stageName: string) {
  return DEAL_COLUMN[stageName] ?? 'lead';
}

export type PipelineDeal = {
  kind: 'deal';
  dealId: string;
  name: string;
  email: string | null;
  column: 'audit_pending' | 'proposal';
};
export type PipelineClient = {
  kind: 'client';
  tenantId: string;
  name: string;
  column: 'building' | 'testing' | 'live';
  atRisk: boolean;
};
export type LeadRow = {
  dealId: string | null;
  name: string;
  email: string | null;
  state: 'new' | 'declined';
  reason: string | null;
};

/** Pure: splits agency leads into pipeline deals and the leads tab. */
export function splitLeads(
  leads: readonly {
    firstName: string;
    email: string | null;
    deal: { dealId: string; stageName: string; lostReason: string | null } | null;
  }[]
) {
  const deals: PipelineDeal[] = [];
  const rows: LeadRow[] = [];
  for (const lead of leads) {
    const where = lead.deal ? dealColumn(lead.deal.stageName) : 'lead';
    if (where === 'audit_pending' || where === 'proposal') {
      deals.push({
        kind: 'deal',
        dealId: lead.deal!.dealId,
        name: lead.firstName,
        email: lead.email,
        column: where
      });
    } else if (where === 'declined') {
      rows.push({
        dealId: lead.deal!.dealId,
        name: lead.firstName,
        email: lead.email,
        state: 'declined',
        reason: lead.deal!.lostReason
      });
    } else if (where === 'lead') {
      rows.push({
        dealId: lead.deal?.dealId ?? null,
        name: lead.firstName,
        email: lead.email,
        state: 'new',
        reason: null
      });
    }
    // 'won' deals are represented by the client account.
  }
  return { deals, leadRows: rows };
}

export async function loadSalesSide(caller: StaffCaller, opts: { db?: Db } = {}) {
  const { leads } = await listAgencyLeads(caller, {}, opts);
  return splitLeads(
    leads.map((l) => ({
      firstName: l.firstName,
      email: l.email,
      deal: l.deal
        ? {
            dealId: l.deal.dealId,
            stageName: l.deal.stageName,
            lostReason: l.deal.lostReason ?? null
          }
        : null
    }))
  );
}

/** Moves a deal between Audit pending and Proposal, or declines it with a reason. */
export async function setDealColumn(
  caller: StaffCaller,
  dealId: string,
  to: 'audit_pending' | 'proposal' | 'declined',
  opts: { db?: Db; reason?: string } = {}
) {
  const { stages } = await getAgencyPipeline(caller, opts);
  const name = to === 'declined' ? 'Lost' : STORED_STAGE[to];
  const stage = stages.find((s) => s.name === name);
  if (!stage) throw new AppError('NOT_FOUND', { message: `The ${name} stage is missing.` });
  if (to === 'declined' && !opts.reason?.trim())
    throw new AppError('VALIDATION_FAILED', { message: 'Say why they declined.' });
  return moveAgencyDeal(caller, dealId, stage.id, { db: opts.db, lostReason: opts.reason?.trim() });
}

/** Called once a client account has been created from a deal: contract signed and deposit paid. */
export async function markDealWon(caller: StaffCaller, dealId: string, opts: { db?: Db } = {}) {
  const { stages } = await getAgencyPipeline(caller, opts);
  const won = stages.find((s) => s.name === 'Won');
  if (!won) throw new AppError('NOT_FOUND', { message: 'The Won stage is missing.' });
  return moveAgencyDeal(caller, dealId, won.id, opts);
}
