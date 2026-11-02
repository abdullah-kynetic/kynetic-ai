import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/server/errors';
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  viewAs: vi.fn(),
  create: vi.fn(),
  lead: vi.fn(),
  move: vi.fn(),
  rename: vi.fn(),
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
vi.mock('@/server/agency', () => ({
  getAgencyWorkspace: mocks.create,
  createAgencyLead: mocks.lead,
  moveAgencyDeal: mocks.move,
  renameAgencyStage: mocks.rename
}));
vi.mock('@/app/admin/view-as-guard', () => ({ isViewingAs: mocks.viewAs }));
import {
  createAgencyLeadAction,
  createAgencyWorkspaceAction,
  moveAgencyDealAction,
  renameAgencyStageAction
} from '@/app/admin/agency/actions';
const form = () => {
  const data = new FormData();
  data.set('firstName', 'Synthetic');
  data.set('email', 'lead@example.test');
  data.set('source', 'outbound:cold_call');
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.viewAs.mockResolvedValue(false);
});
describe('M16 F-05/F-17 agency actions', () => {
  it('refuses signed-out, client, VA and pending second-factor callers before touching data', async () => {
    for (const access of [
      { kind: 'sign_in' },
      { kind: 'forbidden' },
      { kind: 'second_factor' },
      { kind: 'ok', role: 'va', user: { id: 'synthetic-va' } }
    ]) {
      mocks.access.mockResolvedValue(access);
      await expect(createAgencyWorkspaceAction()).rejects.toThrow('FORBIDDEN');
      await expect(createAgencyLeadAction(form())).rejects.toThrow('FORBIDDEN');
      await expect(moveAgencyDealAction('deal', form())).rejects.toThrow('FORBIDDEN');
      await expect(renameAgencyStageAction('stage', form())).rejects.toThrow('FORBIDDEN');
    }
    for (const mutation of [mocks.create, mocks.lead, mocks.move, mocks.rename])
      expect(mutation).not.toHaveBeenCalled();
  });
  it('refuses view-as on every mutation', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.viewAs.mockResolvedValue(true);
    for (const action of [
      () => createAgencyWorkspaceAction(),
      () => createAgencyLeadAction(form()),
      () => moveAgencyDealAction('deal', form()),
      () => renameAgencyStageAction('stage', form())
    ])
      await expect(action()).rejects.toThrow('FORBIDDEN');
    for (const mutation of [mocks.create, mocks.lead, mocks.move, mocks.rename])
      expect(mutation).not.toHaveBeenCalled();
  });
  it('derives the source classification from the selected option and refreshes the page', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    await createAgencyLeadAction(form());
    expect(mocks.lead).toHaveBeenCalledWith(
      { id: 'synthetic-admin', kyneticRole: 'admin' },
      {
        firstName: 'Synthetic',
        email: 'lead@example.test',
        direction: 'outbound',
        channel: 'cold_call'
      }
    );
    expect(mocks.revalidate).toHaveBeenCalledWith('/admin/agency');
  });
  it('returns fixed UI error feedback without exposing submitted data or backend details', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.lead.mockRejectedValue(
      new AppError('CONFLICT', { message: 'synthetic-private-backend-detail' })
    );
    await expect(createAgencyLeadAction(form())).rejects.toThrow(
      'REDIRECT:/admin/agency?error=invalid'
    );
  });
});
