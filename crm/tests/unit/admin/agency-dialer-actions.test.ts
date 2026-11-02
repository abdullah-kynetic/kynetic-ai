import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  viewAs: vi.fn(),
  log: vi.fn(),
  dnc: vi.fn(),
  create: vi.fn(),
  assign: vi.fn(),
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
vi.mock('@/server/agency/dialer', () => ({ logAgencyCall: mocks.log, markAgencyDnc: mocks.dnc }));
vi.mock('@/server/agency/campaigns', () => ({
  createAgencyCampaign: mocks.create,
  assignAgencyCampaign: mocks.assign
}));
vi.mock('@/app/admin/view-as-guard', () => ({ isViewingAs: mocks.viewAs }));
import { logAgencyCallAction, markAgencyDncAction } from '@/app/admin/agency/dialer/actions';
import { assignCampaignAction, createCampaignAction } from '@/app/admin/agency/campaigns/actions';
const actions = () => [
  () => logAgencyCallAction('synthetic', new FormData()),
  () => markAgencyDncAction('synthetic'),
  () => createCampaignAction(new FormData()),
  () => assignCampaignAction('synthetic', new FormData())
];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.viewAs.mockResolvedValue(false);
});
describe('M16 F-05/F-19 manual call/campaign actions', () => {
  it('refuses signed-out/client/VA/second-factor callers on every action', async () => {
    for (const access of [
      { kind: 'sign_in' },
      { kind: 'forbidden' },
      { kind: 'second_factor' },
      { kind: 'ok', role: 'va', user: { id: 'synthetic-va' } }
    ]) {
      mocks.access.mockResolvedValue(access);
      for (const action of actions()) await expect(action()).rejects.toThrow('FORBIDDEN');
    }
    for (const fn of [mocks.log, mocks.dnc, mocks.create, mocks.assign])
      expect(fn).not.toHaveBeenCalled();
  });
  it('refuses impersonation on every action', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    mocks.viewAs.mockResolvedValue(true);
    for (const action of actions()) await expect(action()).rejects.toThrow('FORBIDDEN');
    for (const fn of [mocks.log, mocks.dnc, mocks.create, mocks.assign])
      expect(fn).not.toHaveBeenCalled();
  });
  it('logs only the submitted manual outcome through the guarded service', async () => {
    mocks.access.mockResolvedValue({ kind: 'ok', role: 'admin', user: { id: 'synthetic-admin' } });
    const form = new FormData();
    form.set('eventId', 'synthetic-event');
    form.set('outcome', 'no_answer');
    form.set('notes', 'Synthetic note');
    await logAgencyCallAction('synthetic-contact', form);
    expect(mocks.log).toHaveBeenCalledWith(
      { id: 'synthetic-admin', kyneticRole: 'admin' },
      {
        contactId: 'synthetic-contact',
        eventId: 'synthetic-event',
        outcome: 'no_answer',
        notes: 'Synthetic note'
      }
    );
  });
});
