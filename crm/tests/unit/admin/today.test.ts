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
});
