import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  rotate: vi.fn(),
  viewAs: vi.fn(),
  revalidate: vi.fn()
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/server/admin', () => ({ decideAdminAccess: mocks.access }));
vi.mock('@/server/admin/lead-webhooks', () => ({ rotateLeadWebhookSecret: mocks.rotate }));
vi.mock('@/app/admin/view-as-guard', () => ({ isViewingAs: mocks.viewAs }));
import { rotateLeadWebhookAction } from '@/app/admin/clients/[tenantId]/webhooks/actions';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.viewAs.mockResolvedValue(false);
});
describe('M12-05 F-76 webhook secret action', () => {
  it('denies signed-out, client, VA and pending-second-factor requests before issuance', async () => {
    for (const access of [
      { kind: 'sign_in' },
      { kind: 'forbidden' },
      { kind: 'second_factor' },
      { kind: 'ok', role: 'va', user: { id: 'synthetic-va' } }
    ]) {
      mocks.access.mockResolvedValue(access);
      expect((await rotateLeadWebhookAction('synthetic-tenant')).ok).toBe(false);
    }
    expect(mocks.rotate).not.toHaveBeenCalled();
  });
  it('denies a view-as session before issuance', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.viewAs.mockResolvedValue(true);
    expect((await rotateLeadWebhookAction('synthetic-tenant')).ok).toBe(false);
    expect(mocks.rotate).not.toHaveBeenCalled();
  });
  it('returns the one-time issuance result only to the verified admin', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.rotate.mockResolvedValue({ secret: 'synthetic-one-time-value' });
    expect(await rotateLeadWebhookAction('synthetic-tenant')).toEqual({
      ok: true,
      secret: 'synthetic-one-time-value'
    });
    expect(mocks.rotate).toHaveBeenCalledWith(
      { id: 'synthetic-admin', kyneticRole: 'admin' },
      'synthetic-tenant'
    );
    expect(mocks.revalidate).toHaveBeenCalledWith('/admin/clients/synthetic-tenant/webhooks');
  });
  it('never serializes secret-bearing backend errors', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.rotate.mockRejectedValue(new Error('synthetic-credential-must-not-escape'));
    const result = await rotateLeadWebhookAction('synthetic-tenant');
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('synthetic-credential');
  });
});
