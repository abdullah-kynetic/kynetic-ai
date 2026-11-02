import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/server/errors';
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  viewAs: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
  revalidate: vi.fn()
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('next/navigation', () => ({
  forbidden: () => {
    throw new Error('FORBIDDEN');
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }
}));
vi.mock('@/server/admin', () => ({ decideAdminAccess: mocks.access }));
vi.mock('@/server/proposals', () => ({
  openAgencyProposal: mocks.open,
  saveAgencyProposal: mocks.save
}));
vi.mock('@/app/admin/view-as-guard', () => ({ isViewingAs: mocks.viewAs }));
import { openProposalAction, saveProposalAction } from '@/app/admin/agency/proposals/actions';
const initial = { revision: 1, ok: false, message: '' };
const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    dealId: 'synthetic-deal',
    title: 'Synthetic draft',
    problem: 'Synthetic private problem',
    solution: '',
    roadmap: '',
    roi: '',
    expectedRevision: '1'
  }))
    data.set(key, value);
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.viewAs.mockResolvedValue(false);
});
describe('M17-01 F-105 proposal actions', () => {
  it('denies signed-out/client/VA/second-factor callers before any draft operation', async () => {
    for (const access of [
      { kind: 'sign_in' },
      { kind: 'forbidden' },
      { kind: 'second_factor' },
      { kind: 'ok', role: 'va', user: { id: 'synthetic-va' } }
    ]) {
      mocks.access.mockResolvedValue(access);
      await expect(openProposalAction(form())).rejects.toThrow('FORBIDDEN');
      await expect(saveProposalAction('draft', initial, form())).rejects.toThrow('FORBIDDEN');
    }
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('denies impersonation on create and save', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.viewAs.mockResolvedValue(true);
    await expect(openProposalAction(form())).rejects.toThrow('FORBIDDEN');
    await expect(saveProposalAction('draft', initial, form())).rejects.toThrow('FORBIDDEN');
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('refreshes the internal list/editor/preview and carries forward the saved revision', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.save.mockResolvedValue({ revision: 2 });
    expect(await saveProposalAction('draft', initial, form())).toEqual({
      revision: 2,
      ok: true,
      message: 'Draft saved.'
    });
    expect(mocks.save).toHaveBeenCalledWith(
      { id: 'synthetic-admin', kyneticRole: 'admin' },
      'draft',
      {
        title: 'Synthetic draft',
        problem: 'Synthetic private problem',
        solution: '',
        roadmap: '',
        roi: '',
        expectedRevision: 1
      }
    );
    expect(mocks.revalidate).toHaveBeenCalledWith('/admin/agency/proposals/draft/preview');
  });
  it('returns a conflict result without echoing backend content or advancing the stale version', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.save.mockRejectedValue(
      new AppError('CONFLICT', { message: 'synthetic-private-backend' })
    );
    const result = await saveProposalAction('draft', initial, form());
    expect(result).toMatchObject({ revision: 1, ok: false });
    expect(result.message).toContain('Your text is still here');
    expect(JSON.stringify(result)).not.toContain('synthetic-private');
  });
  it('never logs or serializes proposal-bearing persistence errors', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.save.mockRejectedValue(new Error('synthetic-private-sql-parameters'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await saveProposalAction('draft', initial, form());
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain('synthetic-private');
      expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private');
    } finally {
      log.mockRestore();
    }
  });
});
