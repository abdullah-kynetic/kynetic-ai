import { describe, expect, it } from 'vitest';
import { auditFiltersSchema, searchAuditLog } from '@/server/admin';
import { adminNavGroups } from '@/config/nav-config';

describe('audit viewer filters (M8a-05, F-60)', () => {
  it('treats blank fields as no filter and defaults to page 1', () => {
    expect(
      auditFiltersSchema.parse({ tenant: '', actor: '', action: ' ', from: '', to: '', page: '' })
    ).toEqual({ page: 1 });
  });

  it('accepts tenant, user, action and a date range', () => {
    const f = auditFiltersSchema.parse({
      tenant: '11111111-1111-4111-8111-111111111111',
      actor: '22222222-2222-4222-8222-222222222222',
      action: 'module.toggle',
      from: '2026-10-01',
      to: '2026-10-26',
      page: '2'
    });
    expect(f.action).toBe('module.toggle');
    expect(f.page).toBe(2);
  });

  it('rejects ids that are not UUIDs and dates that are not dates', () => {
    expect(auditFiltersSchema.safeParse({ tenant: 'abc' }).success).toBe(false);
    expect(auditFiltersSchema.safeParse({ actor: "x' or 1=1" }).success).toBe(false);
    expect(auditFiltersSchema.safeParse({ from: 'yesterday' }).success).toBe(false);
  });

  it('refuses a client role before any query runs', async () => {
    await expect(
      searchAuditLog({ userId: '22222222-2222-4222-8222-222222222222', role: 'owner' as never }, {})
    ).rejects.toThrow(/staff only/);
  });

  it('is linked in the admin nav', () => {
    const urls = adminNavGroups.flatMap((g) => g.items.map((i) => i.url));
    expect(urls).toContain('/admin/audit');
  });
});
