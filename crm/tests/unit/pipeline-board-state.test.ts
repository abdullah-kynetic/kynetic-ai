import { describe, expect, it } from 'vitest';
import {
  columnStats,
  moveCard,
  sameSpot,
  spotOf,
  type Columns
} from '@/features/pipeline/board/board-state';
import { readBoardFilters } from '@/features/pipeline/board/search-params';
import type { BoardDeal } from '@/server/deals/pipelines';

const deal = (id: string, stageId: string, valueCents: number): BoardDeal => ({
  id,
  title: id,
  valueCents,
  serviceType: null,
  expectedClose: null,
  ownerId: null,
  source: null,
  stageId,
  position: id,
  createdAt: ''
});
const start = (): Columns => ({
  s1: [deal('a', 's1', 100_000), deal('b', 's1', 250_000)],
  s2: [deal('c', 's2', 50_000)],
  s3: []
});

describe('M2-02 kanban state (F-16)', () => {
  it('moves a card to another stage right after a given card', () => {
    const next = moveCard(start(), 'a', 's2', 'c');
    expect(next.s1!.map((d) => d.id)).toEqual(['b']);
    expect(next.s2!.map((d) => d.id)).toEqual(['c', 'a']);
    expect(next.s2![1]!.stageId).toBe('s2');
  });
  it('puts a card at the top with null and at the bottom when omitted', () => {
    expect(moveCard(start(), 'a', 's2', null).s2!.map((d) => d.id)).toEqual(['a', 'c']);
    expect(moveCard(start(), 'a', 's2').s2!.map((d) => d.id)).toEqual(['c', 'a']);
  });
  it('reorders inside one column', () => {
    expect(moveCard(start(), 'b', 's1', null).s1!.map((d) => d.id)).toEqual(['b', 'a']);
  });
  it('column count and dollar total follow a move', () => {
    const next = moveCard(start(), 'b', 's3');
    expect(columnStats(next.s1!)).toEqual({ count: 1, totalCents: 100_000 });
    expect(columnStats(next.s3!)).toEqual({ count: 1, totalCents: 250_000 });
  });
  it('undo is the opposite move: the previous spot restores the original order', () => {
    const before = start();
    const from = spotOf(before, 'a')!;
    const moved = moveCard(before, 'a', 's2', 'c');
    expect(sameSpot(from, spotOf(moved, 'a'))).toBe(false);
    const undone = moveCard(moved, 'a', from.stageId, from.afterDealId);
    expect(undone).toEqual(before);
  });
  it('ignores unknown cards and stages', () => {
    const cols = start();
    expect(moveCard(cols, 'zzz', 's2')).toBe(cols);
    expect(moveCard(cols, 'a', 'nope')).toBe(cols);
  });
});

describe('M2-02 board filters from the URL', () => {
  it('keeps a valid owner and source and drops a malformed owner', () => {
    const owner = '11111111-1111-4111-8111-111111111111';
    expect(readBoardFilters({ owner, source: 'Google' })).toEqual({
      ownerId: owner,
      source: 'Google'
    });
    expect(readBoardFilters({ owner: 'not-a-uuid' })).toEqual({});
    expect(readBoardFilters({})).toEqual({});
  });
});
