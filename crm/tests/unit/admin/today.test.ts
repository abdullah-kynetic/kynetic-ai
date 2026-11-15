import { describe, expect, it } from 'vitest';
import { todayVisibility } from '@/server/admin';

describe('Today role visibility', () => {
  it('keeps admin-only data out of a VA response', () => {
    expect(todayVisibility('va')).toEqual({
      needsYouNow: false,
      salesToday: false,
      clientsNeedingAttention: true,
      support: true,
      dailySummary: false
    });
  });

  it('shows all Today blocks to an admin', () => {
    expect(todayVisibility('admin')).toEqual({
      needsYouNow: true,
      salesToday: true,
      clientsNeedingAttention: true,
      support: true,
      dailySummary: true
    });
  });

  it('keeps navigation titles unique', async () => {
    const { adminNavGroups } = await import('@/config/nav-config');
    const titles = adminNavGroups.flatMap((group) => group.items.map((item) => item.title));
    expect(new Set(titles).size).toBe(titles.length);
  });
});
