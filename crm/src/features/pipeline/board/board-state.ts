import type { BoardDeal } from '@/server/deals/pipelines';

// Pure helpers behind the kanban board (F-16). Columns are keyed by stage id; a column's cards are
// in position order. Nothing here touches the network, so every rule is a plain unit test.

export type Columns = Record<string, BoardDeal[]>;

/** Where a card sits: its stage and the card it follows (null = top of the column). */
export type Spot = { stageId: string; afterDealId: string | null };

export function locate(cols: Columns, dealId: string): { stageId: string; index: number } | null {
  for (const [stageId, deals] of Object.entries(cols)) {
    const index = deals.findIndex((d) => d.id === dealId);
    if (index !== -1) return { stageId, index };
  }
  return null;
}

export function spotOf(cols: Columns, dealId: string): Spot | null {
  const at = locate(cols, dealId);
  if (!at) return null;
  const before = cols[at.stageId]![at.index - 1];
  return { stageId: at.stageId, afterDealId: before?.id ?? null };
}

export const sameSpot = (a: Spot | null, b: Spot | null) =>
  a !== null && b !== null && a.stageId === b.stageId && a.afterDealId === b.afterDealId;

/**
 * Moves a card to `stageId`, right after `afterDealId` (null = top). Leave `afterDealId` undefined
 * to drop it at the bottom, which is what the "Move to stage" menu does.
 */
export function moveCard(
  cols: Columns,
  dealId: string,
  stageId: string,
  afterDealId?: string | null
): Columns {
  const at = locate(cols, dealId);
  const target = cols[stageId];
  if (!at || !target) return cols;
  const card = { ...cols[at.stageId]![at.index]!, stageId };
  const next: Columns = { ...cols };
  next[at.stageId] = cols[at.stageId]!.filter((d) => d.id !== dealId);
  const column = [...(next[stageId] ?? [])];
  let index = column.length;
  if (afterDealId === null) index = 0;
  else if (afterDealId !== undefined) {
    const i = column.findIndex((d) => d.id === afterDealId);
    if (i !== -1) index = i + 1;
  }
  column.splice(index, 0, card);
  next[stageId] = column;
  return next;
}

export function columnStats(deals: BoardDeal[]): { count: number; totalCents: number } {
  return { count: deals.length, totalCents: deals.reduce((sum, d) => sum + d.valueCents, 0) };
}
