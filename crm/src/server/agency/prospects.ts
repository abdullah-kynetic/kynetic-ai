import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { agencyProspects, dncEntries } from '../db/schema';
import { audit } from '../audit';
import { AppError } from '../errors';
import { parseInput } from '../validation';
import type { StaffCaller } from '../admin/users';
import { SYNTHETIC_PHONE, US_STATE_CODES } from './dialer-policy';
import { inAgency, insertAgencyLead } from './index';

export const PROSPECT_SOURCES = ['google_maps', 'directory', 'referral', 'manual'] as const;
export type ProspectSource = (typeof PROSPECT_SOURCES)[number];
export const PROSPECT_STAGES = ['scraped', 'half_enriched', 'fully_enriched'] as const;
export type ProspectStage = (typeof PROSPECT_STAGES)[number];

/** Scraped: name only. Half-enriched: a phone or website. Fully enriched: all four contact fields. */
export function deriveProspectStage(p: {
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  ownerName?: string | null;
}): ProspectStage {
  const has = (v?: string | null) => Boolean(v && v.trim());
  if (has(p.website) && has(p.phone) && has(p.email) && has(p.ownerName)) return 'fully_enriched';
  if (has(p.website) || has(p.phone)) return 'half_enriched';
  return 'scraped';
}

const optional = (schema: z.ZodType<string>) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    schema.optional()
  );

const prospectSchema = z.strictObject({
  businessName: z.string().trim().min(1).max(200),
  source: z.enum(PROSPECT_SOURCES),
  website: optional(z.string().trim().max(300)),
  phone: optional(z.string().regex(SYNTHETIC_PHONE)),
  email: optional(
    z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase())
      .refine((v) => v.endsWith('@example.test'))
  ),
  ownerName: optional(z.string().trim().max(200)),
  city: optional(z.string().trim().max(120)),
  state: optional(
    z
      .enum(US_STATE_CODES as [string, ...string[]])
      .refine((v) => !['FL', 'OK'].includes(v), 'unsupported_business_state')
  )
});

export async function createAgencyProspect(
  caller: StaffCaller,
  raw: unknown,
  opts: { db?: Db } = {}
) {
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const input = parseInput(prospectSchema, raw);
      const [row] = await tx
        .insert(agencyProspects)
        .values({
          tenantId,
          businessName: input.businessName,
          source: input.source,
          website: input.website ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          ownerName: input.ownerName ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          stage: deriveProspectStage(input)
        })
        .returning({ id: agencyProspects.id, stage: agencyProspects.stage });
      await audit(tx, {
        action: 'prospect.create',
        entity: 'agency_prospect',
        entityId: row!.id,
        after: { stage: row!.stage, source: input.source }
      });
      return row!;
    },
    opts
  );
}

const listSchema = z.strictObject({
  stage: z.enum(PROSPECT_STAGES).optional(),
  q: z.string().trim().max(100).optional(),
  source: z.enum(PROSPECT_SOURCES).optional(),
  state: z.string().trim().length(2).optional()
});

export type ProspectRow = typeof agencyProspects.$inferSelect;

/** Prospects still waiting in Prospecting (not yet moved to Sales), newest first, up to 200. */
export async function listAgencyProspects(
  caller: StaffCaller,
  raw: unknown = {},
  opts: { db?: Db } = {}
): Promise<ProspectRow[]> {
  return inAgency(
    caller,
    async (tx) => {
      const f = parseInput(listSchema, raw);
      return tx
        .select()
        .from(agencyProspects)
        .where(
          and(
            isNull(agencyProspects.movedDealId),
            f.stage ? eq(agencyProspects.stage, f.stage) : undefined,
            f.source ? eq(agencyProspects.source, f.source) : undefined,
            f.state ? eq(agencyProspects.state, f.state.toUpperCase()) : undefined,
            f.q
              ? ilike(agencyProspects.businessName, `%${f.q.replace(/[%_\\]/g, '\\$&')}%`)
              : undefined
          )
        )
        .orderBy(desc(agencyProspects.createdAt), agencyProspects.id)
        .limit(200);
    },
    opts
  );
}

export type ProspectFunnel = {
  total: number;
  scraped: number;
  halfEnriched: number;
  fullyEnriched: number;
  movedToSales: number;
  /** Prospects that reached each step, counting those that moved on. */
  steps: { key: string; label: string; reached: number; conversion: number | null }[];
  sources: { source: ProspectSource; count: number }[];
};

/** Counts per enrichment stage, step conversion and source breakdown. */
export async function getProspectFunnel(
  caller: StaffCaller,
  opts: { db?: Db } = {}
): Promise<ProspectFunnel> {
  return inAgency(
    caller,
    async (tx) => {
      const byStage = await tx
        .select({
          stage: agencyProspects.stage,
          moved: isNotNull(agencyProspects.movedDealId),
          n: count()
        })
        .from(agencyProspects)
        .groupBy(agencyProspects.stage, isNotNull(agencyProspects.movedDealId));
      const bySource = await tx
        .select({ source: agencyProspects.source, n: count() })
        .from(agencyProspects)
        .groupBy(agencyProspects.source);
      const n = (stage: string, moved?: boolean) =>
        byStage
          .filter((r) => r.stage === stage && (moved === undefined || r.moved === moved))
          .reduce((sum, r) => sum + r.n, 0);
      const scraped = n('scraped', false);
      const halfEnriched = n('half_enriched', false);
      const fullyEnriched = n('fully_enriched', false);
      const movedToSales = byStage.filter((r) => r.moved).reduce((sum, r) => sum + r.n, 0);
      const total = scraped + halfEnriched + fullyEnriched + movedToSales;
      // Movers were fully enriched or not; count each as having reached the stage they held.
      const movedAt = (stage: string) => n(stage, true);
      const reachedHalf =
        halfEnriched + fullyEnriched + movedAt('half_enriched') + movedAt('fully_enriched');
      const reachedFull = fullyEnriched + movedAt('fully_enriched');
      const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
      return {
        total,
        scraped,
        halfEnriched,
        fullyEnriched,
        movedToSales,
        steps: [
          { key: 'scraped', label: 'Scraped', reached: total, conversion: null },
          {
            key: 'half',
            label: 'Half-enriched',
            reached: reachedHalf,
            conversion: ratio(reachedHalf, total)
          },
          {
            key: 'full',
            label: 'Fully enriched',
            reached: reachedFull,
            conversion: ratio(reachedFull, reachedHalf)
          },
          {
            key: 'sales',
            label: 'Moved to Sales',
            reached: movedToSales,
            conversion: ratio(movedToSales, reachedFull)
          }
        ],
        sources: PROSPECT_SOURCES.map((source) => ({
          source,
          count: bySource.find((r) => r.source === source)?.n ?? 0
        })).filter((s) => s.count > 0)
      };
    },
    opts
  );
}

export type MoveToSalesResult = {
  moved: { prospectId: string; dealId: string }[];
  skipped: { prospectId: string; name: string; reason: string }[];
};

/**
 * Creates a Sales deal for each selected prospect. DB only: the contact is added without a lead
 * event, no message or call is queued, and a prospect that already moved is skipped.
 */
export async function moveProspectsToSales(
  caller: StaffCaller,
  ids: string[],
  opts: { db?: Db } = {}
): Promise<MoveToSalesResult> {
  const picked = parseInput(z.array(z.uuid()).min(1).max(100), ids);
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const rows = await tx
        .select()
        .from(agencyProspects)
        .where(inArray(agencyProspects.id, picked))
        .orderBy(agencyProspects.createdAt, agencyProspects.id)
        .for('update');
      const result: MoveToSalesResult = { moved: [], skipped: [] };
      const found = new Set(rows.map((r) => r.id));
      for (const id of picked)
        if (!found.has(id))
          result.skipped.push({ prospectId: id, name: 'Unknown', reason: 'Not found.' });
      // Compliance: a prospect whose number is on the active do-not-call list never becomes a sales lead.
      const phones = rows.map((r) => r.phone).filter((v): v is string => Boolean(v));
      const dnc = new Set(
        phones.length
          ? (
              await tx
                .select({ number: dncEntries.e164 })
                .from(dncEntries)
                .where(and(isNull(dncEntries.removedAt), inArray(dncEntries.e164, phones)))
            ).map((r) => r.number)
          : []
      );
      for (const p of rows) {
        if (p.movedDealId) {
          result.skipped.push({
            prospectId: p.id,
            name: p.businessName,
            reason: 'Already in Sales.'
          });
          continue;
        }
        if (p.phone && dnc.has(p.phone)) {
          result.skipped.push({
            prospectId: p.id,
            name: p.businessName,
            reason: 'On the do-not-call list.'
          });
          continue;
        }
        if (!p.email) {
          result.skipped.push({
            prospectId: p.id,
            name: p.businessName,
            reason: 'Needs an email first.'
          });
          continue;
        }
        // A savepoint keeps one invalid prospect from rolling back the rest of the batch.
        try {
          const lead = await tx.transaction(async (inner) => {
            const created = await insertAgencyLead(inner, tenantId, caller.id, {
              firstName: p.businessName,
              email: p.email,
              ...(p.phone ? { phone: p.phone } : {}),
              ...(p.state ? { state: p.state } : {}),
              direction: 'outbound',
              channel: 'cold_call'
            });
            await inner
              .update(agencyProspects)
              .set({ movedDealId: created.dealId, movedAt: sql`now()`, updatedAt: sql`now()` })
              .where(eq(agencyProspects.id, p.id));
            return created;
          });
          await audit(tx, {
            action: 'prospect.move_to_sales',
            entity: 'agency_prospect',
            entityId: p.id,
            after: { dealId: lead.dealId }
          });
          result.moved.push({ prospectId: p.id, dealId: lead.dealId });
        } catch (error) {
          if (error instanceof AppError && error.code !== 'INTERNAL') {
            result.skipped.push({ prospectId: p.id, name: p.businessName, reason: error.message });
            continue;
          }
          throw error;
        }
      }
      return result;
    },
    opts
  );
}
