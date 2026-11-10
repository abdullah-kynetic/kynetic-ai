import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { StaffCaller } from '../admin/users';
import { listAdminTenantOverview } from '../admin/overview';
import { audit } from '../audit';
import { neutralizeCsvCell } from '../contacts/export';
import type { Db } from '../db/client';
import {
  agencyCaseStudies,
  agencyExpenses,
  agencyReferrals,
  agencyRevenueEntries,
  contacts,
  deals,
  pipelineStages
} from '../db/schema';
import { AppError } from '../errors';
import { parseInput } from '../validation';
import { buildFinanceMonths, financeSummaryForMonth } from './finance-math';
import { inAgency } from './index';

type Options = { db?: Db; now?: Date };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().int().min(0).max(2_000_000_000);
const note = z.string().trim().max(2000).default('');

function csv(rows: unknown[][]) {
  return `${rows.map((row) => row.map((cell) => neutralizeCsvCell(cell)).join(',')).join('\n')}\n`;
}

export async function getAgencyFinance(caller: StaffCaller, opts: Options = {}) {
  const clients = await listAdminTenantOverview(
    { userId: caller.id, role: 'admin' },
    { db: opts.db }
  );
  const clientNames = new Map(clients.map((client) => [client.tenantId, client.name]));
  return inAgency(
    caller,
    async (tx) => {
      const won = await tx
        .select({
          id: deals.id,
          title: deals.title,
          cents: deals.valueCents,
          wonAt: deals.wonAt
        })
        .from(deals)
        .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
        .where(and(isNull(deals.deletedAt), eq(pipelineStages.isWon, true), isNotNull(deals.wonAt)))
        .orderBy(desc(deals.wonAt));
      const manual = await tx
        .select()
        .from(agencyRevenueEntries)
        .where(isNull(agencyRevenueEntries.deletedAt))
        .orderBy(desc(agencyRevenueEntries.receivedOn), agencyRevenueEntries.id);
      const expenses = await tx
        .select()
        .from(agencyExpenses)
        .where(isNull(agencyExpenses.deletedAt))
        .orderBy(desc(agencyExpenses.spentOn), agencyExpenses.id);
      const referrals = await tx
        .select({
          id: agencyReferrals.id,
          referrerName: agencyReferrals.referrerName,
          contactId: agencyReferrals.contactId,
          contactName: contacts.firstName,
          status: agencyReferrals.status,
          rewardNote: agencyReferrals.rewardNote,
          approvedAt: agencyReferrals.approvedAt
        })
        .from(agencyReferrals)
        .leftJoin(contacts, eq(contacts.id, agencyReferrals.contactId))
        .orderBy(desc(agencyReferrals.createdAt), agencyReferrals.id);
      const studies = (
        await tx
          .select({
            id: agencyCaseStudies.id,
            clientTenantId: agencyCaseStudies.clientTenantId,
            status: agencyCaseStudies.status,
            url: agencyCaseStudies.url,
            note: agencyCaseStudies.note
          })
          .from(agencyCaseStudies)
          .orderBy(desc(agencyCaseStudies.updatedAt), agencyCaseStudies.id)
      ).map((row) => ({
        ...row,
        clientName: row.clientTenantId ? (clientNames.get(row.clientTenantId) ?? null) : null
      }));
      const months = buildFinanceMonths(
        won.flatMap((deal) =>
          deal.wonAt ? [{ cents: deal.cents, wonAt: deal.wonAt, title: deal.title }] : []
        ),
        manual.map((row) => ({
          cents: row.amountCents,
          on: row.receivedOn,
          label: row.note
        })),
        expenses.map((row) => ({
          cents: row.amountCents,
          on: row.spentOn,
          label: row.vendor
        }))
      );
      return {
        months,
        summary: financeSummaryForMonth(months),
        won: won.filter((deal) => deal.wonAt),
        manual,
        expenses,
        referrals,
        studies
      };
    },
    opts
  );
}

export async function getAgencyFinanceSummary(caller: StaffCaller, opts: Options = {}) {
  const finance = await getAgencyFinance(caller, opts);
  return finance.summary;
}

export function agencyFinanceCsv(
  tab: 'revenue' | 'expenses' | 'referrals' | 'case-studies',
  data: Awaited<ReturnType<typeof getAgencyFinance>>
) {
  if (tab === 'expenses')
    return csv([
      ['date', 'vendor', 'category', 'amount_cents', 'note'],
      ...data.expenses.map((row) => [
        row.spentOn,
        row.vendor,
        row.category,
        row.amountCents,
        row.note
      ])
    ]);
  if (tab === 'referrals')
    return csv([
      ['referrer', 'lead', 'status', 'reward_note', 'approved_at'],
      ...data.referrals.map((row) => [
        row.referrerName,
        row.contactName ?? '',
        row.status,
        row.rewardNote,
        row.approvedAt ?? ''
      ])
    ]);
  if (tab === 'case-studies')
    return csv([
      ['client', 'status', 'url', 'note'],
      ...data.studies.map((row) => [row.clientName ?? '', row.status, row.url ?? '', row.note])
    ]);
  return csv([
    ['month', 'source', 'label', 'amount_cents'],
    ...data.months.flatMap((month) => [
      [month.month, 'won deals', '', month.wonCents],
      [month.month, 'manual', '', month.manualCents]
    ]),
    ...data.won.map((deal) => [deal.wonAt?.slice(0, 7) ?? '', 'won deal', deal.title, deal.cents]),
    ...data.manual.map((row) => [
      row.receivedOn.slice(0, 7),
      'manual entry',
      row.note,
      row.amountCents
    ])
  ]);
}

export async function addAgencyExpense(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const input = parseInput(
    z.strictObject({
      spentOn: date,
      vendor: z.string().trim().min(1).max(200),
      category: z.string().trim().min(1).max(80),
      amountCents: money,
      note
    }),
    raw
  );
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const [row] = await tx
        .insert(agencyExpenses)
        .values({ ...input, tenantId, createdBy: caller.id, updatedBy: caller.id })
        .returning();
      await audit(tx, {
        action: 'agency.expense.create',
        entity: 'agency_expense',
        entityId: row!.id,
        after: { amountCents: input.amountCents, vendor: input.vendor }
      });
      return row!;
    },
    opts
  );
}

export async function editAgencyExpense(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const input = parseInput(
    z.strictObject({
      id: z.uuid(),
      spentOn: date,
      vendor: z.string().trim().min(1).max(200),
      category: z.string().trim().min(1).max(80),
      amountCents: money,
      note
    }),
    raw
  );
  return inAgency(
    caller,
    async (tx) => {
      const [before] = await tx
        .select()
        .from(agencyExpenses)
        .where(and(eq(agencyExpenses.id, input.id), isNull(agencyExpenses.deletedAt)))
        .for('update')
        .limit(1);
      if (!before) throw new AppError('NOT_FOUND');
      const now = (opts.now ?? new Date()).toISOString();
      await tx
        .update(agencyExpenses)
        .set({
          spentOn: input.spentOn,
          vendor: input.vendor,
          category: input.category,
          amountCents: input.amountCents,
          note: input.note,
          updatedBy: caller.id,
          updatedAt: now
        })
        .where(eq(agencyExpenses.id, input.id));
      await audit(tx, {
        action: 'agency.expense.update',
        entity: 'agency_expense',
        entityId: input.id,
        before: { amountCents: before.amountCents },
        after: { amountCents: input.amountCents }
      });
    },
    opts
  );
}

export async function deleteAgencyExpense(caller: StaffCaller, id: string, opts: Options = {}) {
  parseInput(z.uuid(), id);
  return inAgency(
    caller,
    async (tx) => {
      const [before] = await tx
        .select()
        .from(agencyExpenses)
        .where(and(eq(agencyExpenses.id, id), isNull(agencyExpenses.deletedAt)))
        .for('update')
        .limit(1);
      if (!before) throw new AppError('NOT_FOUND');
      await tx
        .update(agencyExpenses)
        .set({ deletedAt: (opts.now ?? new Date()).toISOString(), updatedBy: caller.id })
        .where(eq(agencyExpenses.id, id));
      await audit(tx, {
        action: 'agency.expense.delete',
        entity: 'agency_expense',
        entityId: id,
        before: { amountCents: before.amountCents }
      });
    },
    opts
  );
}

export async function addAgencyRevenue(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const input = parseInput(
    z.strictObject({
      receivedOn: date,
      amountCents: z.number().int().min(1).max(2_000_000_000),
      note
    }),
    raw
  );
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const [row] = await tx
        .insert(agencyRevenueEntries)
        .values({ ...input, tenantId, createdBy: caller.id })
        .returning();
      await audit(tx, {
        action: 'agency.revenue.create',
        entity: 'agency_revenue',
        entityId: row!.id,
        after: { amountCents: input.amountCents }
      });
      return row!;
    },
    opts
  );
}

export async function addAgencyReferral(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const input = parseInput(
    z.strictObject({
      referrerName: z.string().trim().min(1).max(200),
      contactId: z.uuid().optional(),
      rewardNote: note
    }),
    raw
  );
  return inAgency(
    caller,
    async (tx, tenantId) => {
      if (input.contactId) {
        const [lead] = await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.id, input.contactId), isNull(contacts.deletedAt)))
          .limit(1);
        if (!lead) throw new AppError('NOT_FOUND');
      }
      const [row] = await tx
        .insert(agencyReferrals)
        .values({
          tenantId,
          referrerName: input.referrerName,
          contactId: input.contactId ?? null,
          rewardNote: input.rewardNote,
          createdBy: caller.id
        })
        .returning();
      await audit(tx, {
        action: 'agency.referral.create',
        entity: 'agency_referral',
        entityId: row!.id,
        after: { status: 'new' }
      });
      return row!;
    },
    opts
  );
}

export async function approveAgencyReferral(caller: StaffCaller, id: string, opts: Options = {}) {
  if (caller.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
  parseInput(z.uuid(), id);
  return inAgency(
    caller,
    async (tx) => {
      const [row] = await tx
        .select()
        .from(agencyReferrals)
        .where(eq(agencyReferrals.id, id))
        .for('update')
        .limit(1);
      if (!row) throw new AppError('NOT_FOUND');
      if (row.status === 'approved') return row;
      const now = (opts.now ?? new Date()).toISOString();
      await tx
        .update(agencyReferrals)
        .set({ status: 'approved', approvedBy: caller.id, approvedAt: now, updatedAt: now })
        .where(eq(agencyReferrals.id, id));
      await audit(tx, {
        action: 'agency.referral.approve',
        entity: 'agency_referral',
        entityId: id,
        before: { status: row.status },
        after: { status: 'approved', approvedBy: caller.id }
      });
    },
    opts
  );
}

const studyStatus = z.enum(['idea', 'drafting', 'approved', 'published']);

export async function saveAgencyCaseStudy(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const input = parseInput(
    z.strictObject({
      id: z.uuid().optional(),
      clientTenantId: z.uuid().optional(),
      status: studyStatus,
      url: z
        .string()
        .trim()
        .max(500)
        .refine((value) => value === '' || /^https?:\/\//.test(value))
        .default(''),
      note
    }),
    raw
  );
  if (input.clientTenantId) {
    const clients = await listAdminTenantOverview(
      { userId: caller.id, role: 'admin' },
      { db: opts.db }
    );
    if (!clients.some((client) => client.tenantId === input.clientTenantId))
      throw new AppError('NOT_FOUND');
  }
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const now = (opts.now ?? new Date()).toISOString();
      const values = {
        clientTenantId: input.clientTenantId ?? null,
        status: input.status,
        url: input.url || null,
        note: input.note,
        updatedBy: caller.id,
        updatedAt: now
      };
      if (!input.id) {
        const [row] = await tx
          .insert(agencyCaseStudies)
          .values({ ...values, tenantId, createdBy: caller.id })
          .returning();
        await audit(tx, {
          action: 'agency.case_study.create',
          entity: 'agency_case_study',
          entityId: row!.id,
          after: { status: input.status }
        });
        return row!;
      }
      const [before] = await tx
        .select()
        .from(agencyCaseStudies)
        .where(eq(agencyCaseStudies.id, input.id))
        .for('update')
        .limit(1);
      if (!before) throw new AppError('NOT_FOUND');
      await tx.update(agencyCaseStudies).set(values).where(eq(agencyCaseStudies.id, input.id));
      await audit(tx, {
        action: 'agency.case_study.update',
        entity: 'agency_case_study',
        entityId: input.id,
        before: { status: before.status },
        after: { status: input.status }
      });
      return { ...before, ...values };
    },
    opts
  );
}
