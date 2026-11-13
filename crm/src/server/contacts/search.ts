import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { checkCustomFilters, customFilterSql, customFilterSchema } from '../custom-fields/filters';
import { listFieldDefs } from '../custom-fields';
import { contacts, memberships, tenants, users } from '../db/schema';
import { withTenant, type TenantContextInput } from '../tenancy';
import { FIELD_LIMITS, parseInput, uuidSchema } from '../validation';
import {
  CONTACT_DEFAULT_PAGE_SIZE,
  CONTACT_PAGE_SIZES,
  CONTACT_SORT_FIELDS,
  CONTACT_STATUSES,
  NO_OWNER,
  type ContactSortField
} from './constants';
import type { Contact, ContactOpts } from './service';

// Leads list query (M1-02; PRD F-05). One validated input covers search, filters, sort and paging,
// so the page, a future API route and saved views all read the same shape. Runs through withTenant,
// so RLS keeps every row and facet inside the caller's tenant.

const calendarDate = z.iso.date();
const shortText = z.string().trim().min(1).max(100);

export const searchContactsSchema = z.strictObject({
  q: z.string().trim().max(FIELD_LIMITS.name).optional(),
  statuses: z.array(z.enum(CONTACT_STATUSES)).max(CONTACT_STATUSES.length).optional(),
  sources: z.array(shortText).max(50).optional(),
  /** Any of these tags (case-insensitive). */
  tags: z.array(shortText).max(50).optional(),
  owners: z
    .array(uuidSchema.or(z.literal(NO_OWNER)))
    .max(50)
    .optional(),
  /** Calendar dates, read in the tenant's timezone; `createdTo` is inclusive. */
  createdFrom: calendarDate.optional(),
  createdTo: calendarDate.optional(),
  /** Custom field filters by field key (CRM Full; only `filterable` fields). See custom-fields/filters. */
  custom: z.record(z.string(), customFilterSchema).optional(),
  sort: z
    .strictObject({ field: z.enum(CONTACT_SORT_FIELDS), desc: z.boolean() })
    .default({ field: 'updatedAt', desc: true }),
  page: z.number().int().min(1).max(100_000).default(1),
  perPage: z
    .number()
    .int()
    .refine((n) => (CONTACT_PAGE_SIZES as readonly number[]).includes(n), 'page_size')
    .default(CONTACT_DEFAULT_PAGE_SIZE)
});
export type SearchContactsInput = z.input<typeof searchContactsSchema>;

export type ContactListRow = Pick<
  Contact,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'primaryPhoneE164'
  | 'primaryEmail'
  | 'status'
  | 'source'
  | 'tags'
  | 'ownerId'
  | 'createdAt'
  | 'updatedAt'
> & { ownerName: string | null; custom: Record<string, unknown> };

export type ContactSearchResult = {
  rows: ContactListRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const nameExpr = sql`(${contacts.firstName} || ' ' || coalesce(${contacts.lastName}, ''))`;

const textArray = (values: string[]) =>
  sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  )}]::text[]`;

function whereFor(v: z.output<typeof searchContactsSchema>, customParts: SQL[] = []): SQL {
  const parts: (SQL | undefined)[] = [isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)];

  if (v.q) {
    const any: SQL[] = [
      sql`${nameExpr} ILIKE ${like(v.q)}`,
      sql`${contacts.primaryEmail} ILIKE ${like(v.q)}`
    ];
    // A phone fragment matches any stored E.164 number, ignoring punctuation the user typed.
    const digits = v.q.replace(/\D/g, '');
    if (digits.length >= 3) {
      // Keep this expression identical to contacts_phone_fragment_trgm so PostgreSQL can use
      // the partial trigram index for fragments of three or more digits.
      any.push(
        sql`regexp_replace(contacts_phones_search(${contacts.phones}), '[^0-9]', '', 'g') LIKE ${like(digits)}`
      );
    }
    parts.push(sql`(${sql.join(any, sql` OR `)})`);
  }
  if (v.statuses?.length) parts.push(sql`${contacts.status} = ANY(${textArray(v.statuses)})`);
  if (v.sources?.length) parts.push(sql`${contacts.source} = ANY(${textArray(v.sources)})`);
  if (v.tags?.length) {
    const lowered = v.tags.map((t) => t.toLowerCase());
    parts.push(
      sql`EXISTS (SELECT 1 FROM unnest(${contacts.tags}) AS t(tag) WHERE lower(t.tag) = ANY(${textArray(lowered)}))`
    );
  }
  if (v.owners?.length) {
    const ids = v.owners.filter((o) => o !== NO_OWNER);
    const any: SQL[] = [];
    if (ids.length) any.push(sql`${contacts.ownerId} = ANY(${textArray(ids)}::uuid[])`);
    if (v.owners.includes(NO_OWNER)) any.push(sql`${contacts.ownerId} IS NULL`);
    parts.push(sql`(${sql.join(any, sql` OR `)})`);
  }
  // Day boundaries come from the tenant's timezone, so "today" means the client's today.
  const tz = sql`(SELECT ${tenants.timezone} FROM ${tenants} WHERE ${tenants.id} = app_tenant_id())`;
  if (v.createdFrom) {
    parts.push(
      sql`${contacts.createdAt} >= (${v.createdFrom}::date)::timestamp AT TIME ZONE ${tz}`
    );
  }
  if (v.createdTo) {
    parts.push(
      sql`${contacts.createdAt} < ((${v.createdTo}::date + 1)::timestamp AT TIME ZONE ${tz})`
    );
  }
  parts.push(...customParts);
  return and(...parts)!;
}

function orderFor(sort: { field: ContactSortField; desc: boolean }): SQL[] {
  const dir = sort.desc ? desc : asc;
  const col: Record<ContactSortField, SQL> = {
    name: sql`lower(${nameExpr})`,
    status: sql`${contacts.status}`,
    source: sql`${contacts.source}`,
    createdAt: sql`${contacts.createdAt}`,
    updatedAt: sql`${contacts.updatedAt}`
  };
  // The id tiebreak keeps paging stable when many rows share a sort value.
  return [
    sort.desc ? sql`${col[sort.field]} DESC NULLS LAST` : sql`${col[sort.field]} ASC NULLS LAST`,
    dir(contacts.id)
  ];
}

async function searchIn(
  tx: Tx,
  ctx: TenantContextInput,
  v: z.output<typeof searchContactsSchema>
): Promise<ContactSearchResult> {
  let customParts: SQL[] = [];
  if (v.custom && Object.keys(v.custom).length) {
    // Throws 403 for a Lite tenant, 400 for an unknown or non-filterable key.
    const defs = await listFieldDefs(ctx, 'contact', { tx });
    customParts = checkCustomFilters(defs, v.custom).map(customFilterSql(contacts.custom));
  }
  const where = whereFor(v, customParts);
  // With a filter the count needs the same full scan as the page, so the total rides on each page row
  // (count(*) over ()) and the table is scanned once instead of twice. The unfiltered list keeps its own
  // count: that count is cheap, and the page itself can stop early on the (tenant, updated_at) index.
  const filtered = Boolean(
    v.q ||
    v.statuses?.length ||
    v.sources?.length ||
    v.tags?.length ||
    v.owners?.length ||
    v.createdFrom ||
    v.createdTo ||
    customParts.length
  );
  const found = await tx
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      primaryPhoneE164: contacts.primaryPhoneE164,
      primaryEmail: contacts.primaryEmail,
      status: contacts.status,
      source: contacts.source,
      tags: contacts.tags,
      ownerId: contacts.ownerId,
      ownerName: sql<string | null>`coalesce(${users.name}, ${users.email})`,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
      custom: contacts.custom,
      matchTotal: filtered ? sql<number>`(count(*) over ())::int` : sql<number>`0`
    })
    .from(contacts)
    .leftJoin(users, eq(users.id, contacts.ownerId))
    .where(where)
    .orderBy(...orderFor(v.sort))
    .limit(v.perPage)
    .offset((v.page - 1) * v.perPage);
  let total = found[0]?.matchTotal ?? 0;
  // Unfiltered, or a page past the end (no row to carry the total): count separately.
  if (!filtered || (found.length === 0 && v.page > 1)) {
    [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(contacts)
      .where(where);
  }
  const pageCount = Math.max(1, Math.ceil(total / v.perPage));
  const rows = found.map(({ matchTotal: _matchTotal, ...row }) => row);
  return { rows: rows as ContactListRow[], total, page: v.page, perPage: v.perPage, pageCount };
}

/** One page of the tenant's live contacts (not deleted, not merged away) and the matching total. */
export async function searchContacts(
  ctx: TenantContextInput,
  input: SearchContactsInput = {},
  opts: ContactOpts = {}
): Promise<ContactSearchResult> {
  const v = parseInput(searchContactsSchema, input);
  return opts.tx
    ? searchIn(opts.tx, ctx, v)
    : withTenant(ctx, (tx) => searchIn(tx, ctx, v), { db: opts.db });
}

export type ContactFacets = {
  sources: string[];
  tags: string[];
  owners: { id: string; name: string }[];
  /** The tenant's IANA timezone, for showing dates the way the date filter reads them. */
  timezone: string;
};

/** Filter options for the list: sources and tags in use, the tenant's members as owners, and its timezone. */
export async function contactFacets(
  ctx: TenantContextInput,
  opts: ContactOpts = {}
): Promise<ContactFacets> {
  const load = async (tx: Tx): Promise<ContactFacets> => {
    const live = and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId));
    const sources = await tx
      .selectDistinct({ v: contacts.source })
      .from(contacts)
      .where(and(live, sql`${contacts.source} IS NOT NULL`))
      .orderBy(asc(contacts.source))
      .limit(100);
    const tags = await tx.execute<{ v: string }>(
      sql`SELECT min(t.tag) AS v FROM ${contacts}, unnest(${contacts.tags}) AS t(tag)
          WHERE ${contacts.deletedAt} IS NULL AND ${contacts.mergedIntoId} IS NULL
          GROUP BY lower(t.tag) ORDER BY lower(t.tag) LIMIT 200`
    );
    const owners = await tx
      .select({ id: users.id, name: sql<string>`coalesce(${users.name}, ${users.email})` })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(sql`${memberships.tenantId} = app_tenant_id()`)
      .orderBy(sql`lower(coalesce(${users.name}, ${users.email}))`);
    const [tenant] = await tx
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(sql`${tenants.id} = app_tenant_id()`);
    return {
      timezone: tenant?.timezone ?? 'UTC',
      sources: sources.map((s) => s.v).filter((s): s is string => s !== null),
      tags: [...tags].map((t) => t.v),
      owners
    };
  };
  return opts.tx ? load(opts.tx) : withTenant(ctx, load, { db: opts.db });
}
