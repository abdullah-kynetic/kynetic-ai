import { describe, expect, it } from 'vitest';
import { isFiltered, readListView } from '@/features/contacts/list/search-params';

describe('M1-02 leads list URL state (F-05)', () => {
  it('reads the defaults from an empty URL', () => {
    const v = readListView({});
    expect(v).toEqual({
      sort: { field: 'updatedAt', desc: true },
      page: 1,
      perPage: 20,
      hidden: []
    });
    expect(isFiltered(v)).toBe(false);
  });

  it('reads the keys the table writes, so a pasted URL rebuilds the view', () => {
    const v = readListView({
      q: ' ana ',
      status: 'new,booked',
      source: 'facebook,angi',
      tags: '"roof, flat",vip',
      owner: 'none',
      createdAt: '2026-10-01,2026-10-10',
      sort: 'name.asc',
      page: '3',
      perPage: '50',
      hide: 'email,tags'
    });
    expect(v).toEqual({
      q: 'ana',
      statuses: ['new', 'booked'],
      sources: ['facebook', 'angi'],
      tags: ['roof, flat', 'vip'],
      owners: ['none'],
      createdFrom: '2026-10-01',
      createdTo: '2026-10-10',
      sort: { field: 'name', desc: false },
      page: 3,
      perPage: 50,
      hidden: ['email', 'tags']
    });
    expect(isFiltered(v)).toBe(true);
  });

  it('falls back instead of failing on a hand-edited URL', () => {
    const v = readListView({
      status: 'new,bogus',
      sort: 'password.desc',
      page: '-2',
      perPage: '1000',
      hide: 'name,nope',
      createdAt: 'yesterday',
      source: 'not.in.facebook'
    });
    expect(v.statuses).toEqual(['new']);
    expect(v.sort).toEqual({ field: 'updatedAt', desc: true });
    expect(v.page).toBe(1);
    expect(v.perPage).toBe(20);
    expect(v.hidden).toEqual([]);
    expect(v.createdFrom).toBeUndefined();
    expect(v.sources).toBeUndefined();
  });

  it('keeps an open-ended date range', () => {
    expect(readListView({ createdAt: '2026-10-01,' })).toMatchObject({ createdFrom: '2026-10-01' });
  });
});
