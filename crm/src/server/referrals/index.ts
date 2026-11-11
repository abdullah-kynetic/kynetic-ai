import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { recordActivity } from '../activity';
import { audit } from '../audit';
import { findDuplicates, createContact } from '../contacts';
import { phoneInputSchema } from '../contacts/schemas';
import type { Db, Tx } from '../db/client';
import { clientReferrals, contacts } from '../db/schema';
import { AppError } from '../errors';
import { calendarDateInTimeZone } from '../metrics';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';
import { nameSchema, parseInput, uuidSchema } from '../validation';
import {
  REFERRAL_REWARD_STATUSES,
  REFERRAL_STATUSES,
  type ReferralRow,
  type ReferralRewardStatus,
  type ReferralStatus
} from './constants';
export {
  REFERRAL_REWARD_STATUSES,
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABEL,
  type ReferralRewardStatus,
  type ReferralRow,
  type ReferralStatus
} from './constants';

/**
 * Client referrals (SPEC 01). CRM Full surface. A referral is a client introducing someone they
 * know; a new referee becomes a contact with `source = 'referral'`. Rewards are money, so only the
 * tenant owner may edit `rewardCents` / `rewardStatus` (DECISIONS-LOG).
 */

export type ReferralKpis = {
  thisMonth: number;
  /** Whole percent won over the last 90 days. Null when nothing was referred. */
  conversion90: number | null;
  rewardsPendingCents: number;
};

export type ReferralsData = { rows: ReferralRow[]; kpis: ReferralKpis };

export type ReferralOpts = { db?: Db; tx?: Tx; now?: Date };

function run<T>(ctx: TenantContextInput, opts: ReferralOpts, fn: (tx: Tx) => Promise<T>) {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}

const fullName = (row: { firstName: string; lastName: string | null }) =>
  [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unnamed contact';

export function resolveReferralStatus(raw: string | undefined): ReferralStatus | undefined {
  return REFERRAL_STATUSES.includes(raw as ReferralStatus) ? (raw as ReferralStatus) : undefined;
}

export function conversionPercent(won: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((won / total) * 100);
}

async function referrerNames(tx: Tx, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await tx
    .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
    .from(contacts)
    .where(inArray(contacts.id, ids));
  return new Map(rows.map((r) => [r.id, fullName(r)]));
}

export async function listReferrals(
  ctx: TenantContextInput,
  filter: { status?: ReferralStatus } = {},
  opts: ReferralOpts = {}
): Promise<ReferralsData> {
  const now = opts.now ?? new Date();
  const read = async (tx: Tx): Promise<ReferralsData> => {
    await requireModule(ctx, 'crm', { level: 'full', tx });
    const [tenant] = await tx.execute<{ timezone: string }>(
      sql`select timezone from tenants where id = app_tenant_id()`
    );
    const today = calendarDateInTimeZone(now, tenant?.timezone ?? 'UTC');
    const monthStart = `${today.slice(0, 7)}-01T00:00:00.000Z`;
    const ninetyDaysAgo = new Date(
      Date.parse(`${today}T00:00:00.000Z`) - 89 * 86_400_000
    ).toISOString();

    const rows = await tx
      .select()
      .from(clientReferrals)
      .where(filter.status ? eq(clientReferrals.status, filter.status) : undefined)
      .orderBy(desc(clientReferrals.createdAt))
      .limit(100);
    const names = await referrerNames(tx, [...new Set(rows.map((r) => r.referrerContactId))]);

    const [monthRow] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(clientReferrals)
      .where(gte(clientReferrals.createdAt, monthStart));
    const [windowRow] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        won: sql<number>`count(*) filter (where ${clientReferrals.status} = 'won')::int`
      })
      .from(clientReferrals)
      .where(gte(clientReferrals.createdAt, ninetyDaysAgo));
    const [rewardRow] = await tx
      .select({ cents: sql<number>`coalesce(sum(${clientReferrals.rewardCents}), 0)::int` })
      .from(clientReferrals)
      .where(eq(clientReferrals.rewardStatus, 'pending'));

    return {
      rows: rows.map((r) => ({
        id: r.id,
        referrerContactId: r.referrerContactId,
        referrerName: names.get(r.referrerContactId) ?? 'Unknown contact',
        refereeContactId: r.refereeContactId,
        refereeName: r.refereeName,
        refereePhone: r.refereePhone,
        status: r.status as ReferralStatus,
        rewardCents: r.rewardCents,
        rewardStatus: r.rewardStatus as ReferralRewardStatus,
        notes: r.notes,
        createdAt: r.createdAt
      })),
      kpis: {
        thisMonth: Number(monthRow?.n ?? 0),
        conversion90: conversionPercent(Number(windowRow?.won ?? 0), Number(windowRow?.total ?? 0)),
        rewardsPendingCents: Number(rewardRow?.cents ?? 0)
      }
    };
  };
  return run(ctx, opts, read);
}

export type ReferralContactOption = { id: string; name: string };

export async function referralContactOptions(
  ctx: TenantContextInput,
  opts: ReferralOpts = {}
): Promise<ReferralContactOption[]> {
  const read = async (tx: Tx) => {
    await requireModule(ctx, 'crm', { level: 'full', tx });
    const rows = await tx
      .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)))
      .orderBy(desc(contacts.createdAt))
      .limit(100);
    return rows.map((r) => ({ id: r.id, name: fullName(r) }));
  };
  return run(ctx, opts, read);
}

export const createReferralSchema = z.strictObject({
  referrerContactId: uuidSchema,
  refereeName: nameSchema,
  refereePhone: phoneInputSchema,
  status: z.enum(REFERRAL_STATUSES).default('new'),
  notes: z.string().trim().max(2000).default('')
});
export type CreateReferralInput = z.input<typeof createReferralSchema>;

/**
 * Creates the referral, then links the referee to a contact. An existing live contact with the same
 * phone is reused (so a referral never duplicates a lead); otherwise a new contact is created with
 * `source = 'referral'`. The referrer gets an activity either way.
 */
export async function createReferral(
  ctx: TenantContextInput,
  input: CreateReferralInput,
  opts: ReferralOpts = {}
): Promise<{ id: string; refereeContactId: string }> {
  if (ctx.readOnly) throw new AppError('FORBIDDEN');
  const value = parseInput(createReferralSchema, input);
  const now = opts.now ?? new Date();
  const write = async (tx: Tx) => {
    await requireModule(ctx, 'crm', { level: 'full', tx });
    const [referrer] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, value.referrerContactId),
          isNull(contacts.deletedAt),
          isNull(contacts.mergedIntoId)
        )
      )
      .limit(1);
    if (!referrer) throw new AppError('NOT_FOUND');

    const matches = await findDuplicates(ctx, { phones: [value.refereePhone] }, { tx });
    const refereeContactId =
      matches[0]?.id ??
      (
        await createContact(
          ctx,
          {
            firstName: value.refereeName,
            phones: [value.refereePhone],
            source: 'referral',
            status: 'new'
          },
          { tx, acknowledgeDuplicates: true }
        )
      ).id;

    const [row] = await tx
      .insert(clientReferrals)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        referrerContactId: value.referrerContactId,
        refereeContactId,
        refereeName: value.refereeName,
        refereePhone: value.refereePhone,
        status: value.status,
        notes: value.notes,
        createdBy: ctx.userId ?? null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      })
      .returning({ id: clientReferrals.id });
    await audit(tx, {
      action: 'referral.create',
      entity: 'client_referral',
      entityId: row.id,
      after: {
        referrerContactId: value.referrerContactId,
        refereeContactId,
        status: value.status
      }
    });
    await recordActivity(tx, {
      contactId: value.referrerContactId,
      type: 'system',
      refTable: 'client_referral',
      refId: row.id,
      summary: `Referred ${value.refereeName}`,
      actor: { type: 'user', id: ctx.userId ?? null },
      occurredAt: now
    });
    return { id: row.id, refereeContactId };
  };
  return run(ctx, opts, write);
}

export const updateReferralSchema = z
  .strictObject({
    status: z.enum(REFERRAL_STATUSES).optional(),
    notes: z.string().trim().max(2000).optional(),
    refereeName: nameSchema.optional(),
    refereePhone: phoneInputSchema.nullable().optional(),
    rewardCents: z.number().int().min(0).max(10_000_000).optional(),
    rewardStatus: z.enum(REFERRAL_REWARD_STATUSES).optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'at_least_one_field' });
export type UpdateReferralInput = z.input<typeof updateReferralSchema>;

/** Edits a referral. Reward fields need the tenant owner; staff edits are limited to the rest. */
export async function updateReferral(
  ctx: TenantContextInput,
  id: string,
  input: UpdateReferralInput,
  opts: ReferralOpts = {}
): Promise<void> {
  if (ctx.readOnly) throw new AppError('FORBIDDEN');
  const value = parseInput(updateReferralSchema, input);
  const rewardTouched = value.rewardCents !== undefined || value.rewardStatus !== undefined;
  if (rewardTouched && ctx.role !== 'owner') throw new AppError('FORBIDDEN');
  const now = opts.now ?? new Date();
  const write = async (tx: Tx) => {
    await requireModule(ctx, 'crm', { level: 'full', tx });
    const [before] = await tx
      .select()
      .from(clientReferrals)
      .where(eq(clientReferrals.id, id))
      .limit(1);
    if (!before) throw new AppError('NOT_FOUND');
    const [after] = await tx
      .update(clientReferrals)
      .set({
        ...(value.status !== undefined ? { status: value.status } : {}),
        ...(value.notes !== undefined ? { notes: value.notes } : {}),
        ...(value.refereeName !== undefined ? { refereeName: value.refereeName } : {}),
        ...(value.refereePhone !== undefined ? { refereePhone: value.refereePhone } : {}),
        ...(value.rewardCents !== undefined ? { rewardCents: value.rewardCents } : {}),
        ...(value.rewardStatus !== undefined ? { rewardStatus: value.rewardStatus } : {}),
        updatedAt: now.toISOString()
      })
      .where(eq(clientReferrals.id, id))
      .returning();
    await audit(tx, {
      action: 'referral.update',
      entity: 'client_referral',
      entityId: id,
      before: {
        status: before.status,
        rewardCents: before.rewardCents,
        rewardStatus: before.rewardStatus
      },
      after: {
        status: after.status,
        rewardCents: after.rewardCents,
        rewardStatus: after.rewardStatus
      }
    });
  };
  return run(ctx, opts, write);
}
