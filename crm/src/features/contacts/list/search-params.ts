import {
  CONTACT_DEFAULT_PAGE_SIZE,
  CONTACT_PAGE_SIZES,
  CONTACT_SORT_FIELDS,
  CONTACT_STATUSES,
  type ContactSortField,
  type ContactStatus
} from '@/server/contacts/constants';
import { parseColumnFilter, getSortingStateParser } from '@/lib/data-table-parsers';
import type { FilterVariant } from '@/lib/data-table-types';

// URL state for the leads list (F-05, DESIGN_SYSTEM data table: "view state lives in the URL query so
// links are shareable"). The keys are the ones the starter's useDataTable writes, plus `q` (search)
// and `hide` (hidden columns). A pasted URL rebuilds the same view; anything malformed falls back to
// the default instead of failing the page.

export const LIST_COLUMNS = [
  'name',
  'phone',
  'email',
  'status',
  'source',
  'tags',
  'owner',
  'createdAt',
  'updatedAt'
] as const;
export type ListColumn = (typeof LIST_COLUMNS)[number];

/** Columns a user may hide. Name stays, so every row keeps its link. */
export const HIDEABLE_COLUMNS = LIST_COLUMNS.filter((c) => c !== 'name');

export const FILTER_VARIANTS = {
  status: 'multiSelect',
  source: 'multiSelect',
  tags: 'multiSelect',
  owner: 'multiSelect',
  createdAt: 'dateRange'
} as const satisfies Partial<Record<ListColumn, FilterVariant>>;

export const DEFAULT_SORT = { id: 'updatedAt' as ContactSortField, desc: true };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ListView = {
  q?: string;
  statuses?: ContactStatus[];
  sources?: string[];
  tags?: string[];
  owners?: string[];
  createdFrom?: string;
  createdTo?: string;
  sort: { field: ContactSortField; desc: boolean };
  page: number;
  perPage: number;
  hidden: ListColumn[];
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function listFilter(params: RawSearchParams, id: keyof typeof FILTER_VARIANTS): string[] {
  const raw = first(params[id]);
  if (!raw) return [];
  const f = parseColumnFilter(id, FILTER_VARIANTS[id], raw);
  // Only the plain operator (the one the toolbar writes) is honoured.
  const plain = FILTER_VARIANTS[id] === 'dateRange' ? 'isBetween' : 'inArray';
  if (f.operator !== plain || !Array.isArray(f.value)) return [];
  return f.value;
}

const sortParser = getSortingStateParser<ContactSortField>(CONTACT_SORT_FIELDS);

/** Reads the page's search params into the list query. Never throws. */
export function readListView(params: RawSearchParams): ListView {
  const view: ListView = {
    sort: { field: DEFAULT_SORT.id, desc: DEFAULT_SORT.desc },
    page: 1,
    perPage: CONTACT_DEFAULT_PAGE_SIZE,
    hidden: []
  };

  const q = first(params.q)?.trim();
  if (q) view.q = q.slice(0, 200);

  const statuses = listFilter(params, 'status').filter((s): s is ContactStatus =>
    (CONTACT_STATUSES as readonly string[]).includes(s)
  );
  if (statuses.length) view.statuses = statuses;
  const sources = listFilter(params, 'source').slice(0, 50);
  if (sources.length) view.sources = sources;
  const tags = listFilter(params, 'tags').slice(0, 50);
  if (tags.length) view.tags = tags;
  const owners = listFilter(params, 'owner').slice(0, 50);
  if (owners.length) view.owners = owners;

  const [from, to] = listFilter(params, 'createdAt');
  if (from && DATE.test(from)) view.createdFrom = from;
  if (to && DATE.test(to)) view.createdTo = to;

  const sort = sortParser.parseServerSide(first(params.sort))?.[0];
  if (sort) view.sort = { field: sort.id, desc: sort.desc };

  const page = Number(first(params.page));
  if (Number.isInteger(page) && page >= 1 && page <= 100_000) view.page = page;
  const perPage = Number(first(params.perPage));
  if ((CONTACT_PAGE_SIZES as readonly number[]).includes(perPage)) view.perPage = perPage;

  const hide = first(params.hide);
  if (hide) {
    view.hidden = hide
      .split(',')
      .filter((c): c is ListColumn => (HIDEABLE_COLUMNS as readonly string[]).includes(c));
  }
  return view;
}

/** True when any search or filter narrows the list (drives the "No contacts match" empty state). */
export function isFiltered(view: ListView): boolean {
  return Boolean(
    view.q ||
    view.statuses ||
    view.sources ||
    view.tags ||
    view.owners ||
    view.createdFrom ||
    view.createdTo
  );
}
