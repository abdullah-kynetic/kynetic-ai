import { boardFiltersSchema, type BoardFilters } from '@/server/deals/schemas';

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Board filters from the URL (owner and source, F-16). A shared link rebuilds the same view; a value
 * that does not validate is dropped instead of failing the page.
 */
export function readBoardFilters(raw: RawSearchParams): BoardFilters {
  const candidate = {
    ownerId: first(raw.owner) || undefined,
    source: first(raw.source) || undefined
  };
  const out: BoardFilters = {};
  const owner = boardFiltersSchema.safeParse({ ownerId: candidate.ownerId });
  if (candidate.ownerId && owner.success) out.ownerId = candidate.ownerId;
  const source = boardFiltersSchema.safeParse({ source: candidate.source });
  if (candidate.source && source.success) out.source = candidate.source;
  return out;
}
