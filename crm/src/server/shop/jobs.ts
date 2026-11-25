import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../db/client';
import {
  contacts,
  dealContacts,
  deals,
  memberships,
  pipelines,
  pipelineStages,
  users
} from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import type { InsuranceRow, JobCard, JobsStage, PaymentType, Supplement, TeamOwner } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Picked up and Lost columns only show the last 60 days, so the board stays a working view. */
const CLOSED_WINDOW_DAYS = 60;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function paymentTypeOf(v: unknown): PaymentType | null {
  if (v === 'Insurance') return 'insurance';
  if (v === 'Out-of-pocket') return 'out_of_pocket';
  return null;
}

type DealRow = {
  id: string;
  title: string;
  stageId: string;
  stageName: string;
  valueCents: number;
  ownerId: string | null;
  custom: unknown;
  createdAt: string;
  updatedAt: string;
  wonAt: string | null;
};

/** Open and recently closed deals of the default pipeline, with stage names. Reads through RLS. */
async function loadDeals(tx: Tx, now: Date) {
  const [pipeline] = await tx
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.isDefault, true))
    .limit(1);
  if (!pipeline)
    return {
      stages: [],
      rows: [] as DealRow[],
      customers: new Map<string, { id: string; name: string }>()
    };
  const stages = await tx
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipeline.id))
    .orderBy(asc(pipelineStages.position));
  const since = new Date(now.getTime() - CLOSED_WINDOW_DAYS * DAY_MS).toISOString();
  const rows = (await tx
    .select({
      id: deals.id,
      title: deals.title,
      stageId: deals.stageId,
      stageName: pipelineStages.name,
      valueCents: deals.valueCents,
      ownerId: deals.ownerId,
      custom: deals.custom,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      wonAt: deals.wonAt
    })
    .from(deals)
    .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
    .where(
      and(
        eq(deals.pipelineId, pipeline.id),
        isNull(deals.deletedAt),
        sql`(${pipelineStages.isWon} = false and ${pipelineStages.isLost} = false
          or ${deals.updatedAt} >= ${since})`
      )
    )
    .orderBy(asc(deals.createdAt))) as DealRow[];
  const customers = new Map<string, { id: string; name: string }>();
  if (rows.length > 0) {
    const links = await tx
      .select({
        dealId: dealContacts.dealId,
        id: contacts.id,
        first: contacts.firstName,
        last: contacts.lastName
      })
      .from(dealContacts)
      .innerJoin(contacts, eq(contacts.id, dealContacts.contactId))
      .where(
        and(
          inArray(
            dealContacts.dealId,
            rows.map((r) => r.id)
          ),
          isNull(contacts.deletedAt)
        )
      )
      .orderBy(asc(dealContacts.createdAt));
    for (const l of links) {
      if (customers.has(l.dealId)) continue;
      const name = `${l.first} ${l.last ?? ''}`.trim();
      if (name) customers.set(l.dealId, { id: l.id, name });
    }
  }
  return { stages, rows, customers };
}

export function toJobCard(
  row: DealRow,
  customer: { id: string; name: string } | undefined,
  now: Date
): JobCard {
  const custom = (row.custom && typeof row.custom === 'object' ? row.custom : {}) as Record<
    string,
    unknown
  >;
  const year = num(custom.vehicle_year);
  const make = str(custom.vehicle_make);
  const model = str(custom.vehicle_model);
  const dropOff = str(custom.drop_off_date);
  const started = dropOff ? new Date(`${dropOff}T12:00:00Z`) : new Date(row.createdAt);
  const estimate = num(custom.estimate_amount);
  return {
    id: row.id,
    title: row.title,
    stageId: row.stageId,
    stageName: row.stageName,
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? null,
    vehicle: { year, make, model },
    vehicleLabel: [year, make, model].filter((p) => p !== null).join(' '),
    tech: str(custom.tech),
    ownerId: row.ownerId,
    paymentType: paymentTypeOf(custom.payment_type),
    insurer: str(custom.insurer),
    claimNumber: str(custom.claim_number),
    amountCents: row.valueCents > 0 ? row.valueCents : (estimate ?? 0),
    dropOffDate: dropOff,
    daysInShop: Math.max(0, Math.floor((now.getTime() - started.getTime()) / DAY_MS)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    wonAt: row.wonAt
  };
}

/** Every job as a card, in stage order, for the other shop reads. */
export async function loadJobCards(tx: Tx, now: Date) {
  const { stages, rows, customers } = await loadDeals(tx, now);
  const cards = rows.map((r) => toJobCard(r, customers.get(r.id), now));
  return { stages, cards };
}

/** Jobs board: the default pipeline's stages as columns, each with its car cards. */
export async function getJobsBoard(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<{ stages: JobsStage[] }> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const { stages, cards } = await loadJobCards(tx, now);
    return {
      stages: stages.map((s) => {
        const jobs = cards.filter((c) => c.stageId === s.id);
        return {
          id: s.id,
          name: s.name,
          position: s.position,
          isWon: s.isWon,
          isLost: s.isLost,
          jobs,
          totalCents: jobs.reduce((n, j) => n + j.amountCents, 0)
        };
      })
    };
  });
}

/** Deals waiting on the insurer, plus supplement records (no table yet, so always empty). */
export async function getInsurance(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<{ waiting: InsuranceRow[]; supplements: Supplement[] }> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const { cards } = await loadJobCards(tx, now);
    return {
      waiting: cards
        .filter((c) => c.stageName === 'Waiting on insurance')
        .map((c) => ({
          ...c,
          waitingDays: Math.max(
            0,
            Math.floor((now.getTime() - new Date(c.updatedAt).getTime()) / DAY_MS)
          )
        })),
      supplements: []
    };
  });
}

const OPEN = (c: JobCard, stages: { id: string; isWon: boolean; isLost: boolean }[]) => {
  const s = stages.find((x) => x.id === c.stageId);
  return !!s && !s.isWon && !s.isLost;
};

/** Open jobs grouped by owner, and the paint queue (the In repair and paint stage). */
export async function getTeam(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<{ owners: TeamOwner[]; paintQueue: JobCard[] }> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const { stages, cards } = await loadJobCards(tx, now);
    const open = cards.filter((c) => OPEN(c, stages));
    const members = await tx
      .select({
        id: users.id,
        name: sql<string>`coalesce(${users.name}, ${users.email})`
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(sql`${memberships.tenantId} = app_tenant_id()`)
      .orderBy(sql`lower(coalesce(${users.name}, ${users.email}))`);
    const owners: TeamOwner[] = members.map((m) => {
      const mine = open.filter((c) => c.ownerId === m.id);
      return {
        ownerId: m.id,
        name: m.name,
        openJobs: mine,
        totalCents: mine.reduce((n, j) => n + j.amountCents, 0)
      };
    });
    const unassigned = open.filter((c) => !members.some((m) => m.id === c.ownerId));
    owners.push({
      ownerId: null,
      name: 'Unassigned',
      openJobs: unassigned,
      totalCents: unassigned.reduce((n, j) => n + j.amountCents, 0)
    });
    return {
      owners,
      paintQueue: open.filter((c) => c.stageName === 'In repair and paint')
    };
  });
}
