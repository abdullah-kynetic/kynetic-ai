import { and, asc, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import { audit } from '../audit';
import { validateCustomValues } from '../custom-fields';
import type { Db, Tx } from '../db/client';
import { companies, contacts, dealContacts, deals, pipelineStages } from '../db/schema';
import { NotFoundError } from '../contacts';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import {
  createCompanySchema,
  listCompaniesSchema,
  updateCompanySchema,
  type CreateCompanyInput,
  type ListCompaniesInput,
  type UpdateCompanyInput
} from './schemas';

// Companies service (M1-05; PRD F-10; DATABASE companies). CRM Lite: every function checks the `crm`
// module first (403 when off, nothing written), then runs through withTenant so RLS isolates tenants.

export type Company = typeof companies.$inferSelect;
export type CompanyOpts = { db?: Db };

/** Rows listed on a company page. The roll-up totals always cover every row, not just these. */
const DETAIL_ROW_LIMIT = 100;

async function gated<T>(
  ctx: TenantContextInput,
  opts: CompanyOpts,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  await requireModule(ctx, 'crm', { db: opts.db });
  return withTenant(ctx, fn, { db: opts.db });
}

/** `%` and `_` in a search box mean themselves. */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function loadLive(tx: Tx, id: string, lock = false): Promise<Company> {
  parseInput(uuidSchema, id);
  const q = tx
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), isNull(companies.deletedAt)))
    .limit(1);
  const [row] = await (lock ? q.for('update') : q);
  if (!row) throw new NotFoundError();
  return row;
}

export async function createCompany(
  ctx: TenantContextInput,
  input: CreateCompanyInput,
  opts: CompanyOpts = {}
): Promise<Company> {
  await requireModule(ctx, 'crm', { db: opts.db });
  const v = parseInput(createCompanySchema, input);
  return withTenant(
    ctx,
    async (tx) => {
      const custom = await validateCustomValues(ctx, tx, 'company', v.custom);
      const [row] = await tx
        .insert(companies)
        .values({
          tenantId: sql`app_tenant_id()` as unknown as string,
          name: v.name,
          phoneE164: v.phone ?? null,
          website: v.website ?? null,
          address: v.address,
          custom
        })
        .returning();
      await audit(tx, {
        action: 'company.create',
        entity: 'company',
        entityId: row.id,
        after: { name: row.name }
      });
      return row;
    },
    { db: opts.db }
  );
}

export async function getCompany(
  ctx: TenantContextInput,
  id: string,
  opts: CompanyOpts = {}
): Promise<Company> {
  return gated(ctx, opts, (tx) => loadLive(tx, id));
}

export type CompanyListRow = Company & { contactCount: number; dealCount: number };

/** A page of live companies by name, with how many live contacts and deals each has (F-10). */
export async function listCompanies(
  ctx: TenantContextInput,
  input: ListCompaniesInput = {},
  opts: CompanyOpts = {}
): Promise<{ items: CompanyListRow[]; total: number }> {
  const { q, limit, offset } = parseInput(listCompaniesSchema, input);
  return gated(ctx, opts, async (tx) => {
    const where = and(
      isNull(companies.deletedAt),
      q ? ilike(companies.name, `%${likeLiteral(q)}%`) : undefined
    );
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(companies)
      .where(where);
    const rows = await tx
      .select({
        company: companies,
        // Raw SQL with explicit aliases: Drizzle drops table qualifiers inside sql`` in a select.
        contactCount: sql<number>`(
          select count(*)::int from contacts ct
           where ct.company_id = companies.id
             and ct.deleted_at is null and ct.merged_into_id is null)`,
        dealCount: sql<number>`(
          select count(distinct d.id)::int from deals d
            join deal_contacts dc on dc.deal_id = d.id
            join contacts ct on ct.id = dc.contact_id
           where ct.company_id = companies.id
             and ct.deleted_at is null and ct.merged_into_id is null
             and d.deleted_at is null)`
      })
      .from(companies)
      .where(where)
      .orderBy(asc(sql`lower(${companies.name})`), asc(companies.id))
      .limit(limit)
      .offset(offset);
    return {
      total,
      items: rows.map((r) => ({
        ...r.company,
        contactCount: r.contactCount,
        dealCount: r.dealCount
      }))
    };
  });
}

export async function updateCompany(
  ctx: TenantContextInput,
  id: string,
  patch: UpdateCompanyInput,
  opts: CompanyOpts = {}
): Promise<Company> {
  await requireModule(ctx, 'crm', { db: opts.db });
  const v = parseInput(updateCompanySchema, patch);
  return withTenant(
    ctx,
    async (tx) => {
      const before = await loadLive(tx, id, true);
      const { phone, ...rest } = v;
      if (rest.custom !== undefined) {
        rest.custom = await validateCustomValues(ctx, tx, 'company', rest.custom);
      }
      const set: Partial<typeof companies.$inferInsert> = {
        ...rest,
        updatedAt: sql`now()` as unknown as string
      };
      if (phone !== undefined) set.phoneE164 = phone;
      const [after] = await tx.update(companies).set(set).where(eq(companies.id, id)).returning();
      const changed = (
        [
          ['name', before.name, after.name],
          ['phone', before.phoneE164, after.phoneE164],
          ['website', before.website, after.website],
          ['address', before.address, after.address],
          ['custom', before.custom, after.custom]
        ] as const
      ).filter(([, a, b]) => JSON.stringify(a) !== JSON.stringify(b));
      if (changed.length) {
        await audit(tx, {
          action: 'company.update',
          entity: 'company',
          entityId: id,
          before: Object.fromEntries(changed.map(([k, a]) => [k, a])),
          after: Object.fromEntries(changed.map(([k, , b]) => [k, b]))
        });
      }
      return after;
    },
    { db: opts.db }
  );
}

/**
 * Soft delete. Contacts that pointed at the company are detached in the same transaction so no live
 * contact shows a deleted company; the contacts themselves and their deals are untouched.
 */
export async function deleteCompany(
  ctx: TenantContextInput,
  id: string,
  opts: CompanyOpts = {}
): Promise<void> {
  await gated(ctx, opts, async (tx) => {
    await loadLive(tx, id, true);
    const detached = await tx
      .update(contacts)
      .set({ companyId: null, updatedAt: sql`now()` as unknown as string })
      .where(eq(contacts.companyId, id))
      .returning({ id: contacts.id });
    await tx
      .update(companies)
      .set({
        deletedAt: sql`now()` as unknown as string,
        updatedAt: sql`now()` as unknown as string
      })
      .where(eq(companies.id, id));
    await audit(tx, {
      action: 'company.delete',
      entity: 'company',
      entityId: id,
      after: { detachedContacts: detached.length }
    });
  });
}

export type CompanyRollup = {
  contactCount: number;
  dealCount: number;
  /** Sum of value over every live deal that has a contact at this company; a deal counts once. */
  totalValueCents: number;
  openValueCents: number;
  wonValueCents: number;
};

export type CompanyDetail = {
  company: Company;
  rollup: CompanyRollup;
  contacts: Pick<
    Contact,
    'id' | 'firstName' | 'lastName' | 'primaryPhoneE164' | 'primaryEmail' | 'status'
  >[];
  deals: {
    id: string;
    title: string;
    valueCents: number;
    stage: string;
    wonAt: string | null;
    lostAt: string | null;
  }[];
};

type Contact = typeof contacts.$inferSelect;

/**
 * The company page (F-10): the company, its contacts, its deals and the roll-up totals. A deal
 * belongs to a company through the contacts on it (`deal_contacts`), so deals are counted once even
 * when several of the company's contacts are on the same deal.
 */
export async function getCompanyDetail(
  ctx: TenantContextInput,
  id: string,
  opts: CompanyOpts = {}
): Promise<CompanyDetail> {
  return gated(ctx, opts, async (tx) => {
    const company = await loadLive(tx, id);
    const liveContact = and(
      eq(contacts.companyId, id),
      isNull(contacts.deletedAt),
      isNull(contacts.mergedIntoId)
    );
    const contactRows = await tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        primaryPhoneE164: contacts.primaryPhoneE164,
        primaryEmail: contacts.primaryEmail,
        status: contacts.status
      })
      .from(contacts)
      .where(liveContact)
      .orderBy(asc(sql`lower(${contacts.firstName})`), asc(contacts.id))
      .limit(DETAIL_ROW_LIMIT);
    const [{ contactCount }] = await tx
      .select({ contactCount: sql<number>`count(*)::int` })
      .from(contacts)
      .where(liveContact);

    const companyDeals = tx
      .selectDistinct({ id: deals.id })
      .from(deals)
      .innerJoin(dealContacts, eq(dealContacts.dealId, deals.id))
      .innerJoin(contacts, eq(contacts.id, dealContacts.contactId))
      .where(and(liveContact, isNull(deals.deletedAt)))
      .as('company_deals');

    const [totals] = await tx
      .select({
        dealCount: sql<number>`count(*)::int`,
        totalValueCents: sql<number>`coalesce(sum(${deals.valueCents}), 0)::int`,
        wonValueCents: sql<number>`coalesce(sum(${deals.valueCents}) filter (where ${deals.wonAt} is not null), 0)::int`,
        openValueCents: sql<number>`coalesce(sum(${deals.valueCents}) filter (where ${deals.wonAt} is null and ${deals.lostAt} is null), 0)::int`
      })
      .from(deals)
      .innerJoin(companyDeals, eq(companyDeals.id, deals.id));

    const dealRows = await tx
      .select({
        id: deals.id,
        title: deals.title,
        valueCents: deals.valueCents,
        stage: pipelineStages.name,
        wonAt: deals.wonAt,
        lostAt: deals.lostAt
      })
      .from(deals)
      .innerJoin(companyDeals, eq(companyDeals.id, deals.id))
      .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .orderBy(desc(deals.updatedAt), asc(deals.id))
      .limit(DETAIL_ROW_LIMIT);

    return {
      company,
      rollup: { contactCount, ...totals },
      contacts: contactRows,
      deals: dealRows
    };
  });
}
