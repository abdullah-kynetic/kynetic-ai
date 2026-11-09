import { getTableName } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { Tx } from '@/server/db/client';
import { runDevAttempt, type DevRetry } from '@/server/leads/dev-attempt';
import { ProviderError } from '@/server/adapters/errors';

const phone = '+' + ['1', '555', '555', '0101'].join('');
const ctx = { tenantId: '11111111-1111-4111-8111-111111111111', role: 'system' as const };
const job = {
  contactId: '22222222-2222-4222-8222-222222222222',
  externalId: 'DEV-unit-chain',
  attempt: 1
};
const midday = new Date('2026-11-04T18:00:00Z');
function fixture(
  over: { consent?: boolean; enabled?: boolean; tenantKill?: boolean; phone?: string } = {}
) {
  const contact = {
    id: job.contactId,
    primaryPhoneE164: over.phone ?? phone,
    phone: over.phone ?? phone,
    phones: [],
    address: { state: 'CA' },
    timezone: 'America/Los_Angeles',
    doNotCallAt: null
  };
  const tx = {
    select: (selection?: object) => ({
      from: (table: Parameters<typeof getTableName>[0]) => {
        const name = getTableName(table);
        const rows =
          name === 'contacts'
            ? [contact]
            : name === 'tenants'
              ? [{ status: 'active', timezone: 'America/Los_Angeles' }]
              : name === 'tenant_modules'
                ? [
                    selection && 'config' in selection
                      ? { config: { outbound_kill_switch: over.tenantKill ?? false } }
                      : { enabled: true }
                  ]
                : name === 'alex_configs'
                  ? [{ paused: false }]
                  : name === 'calls'
                    ? [{ n: 0 }]
                    : name === 'consents'
                      ? over.consent === false
                        ? []
                        : [
                            {
                              kind: 'express_written',
                              source: 'form',
                              capturedAt: '2026-11-01T18:00:00Z',
                              revokedAt: null
                            }
                          ]
                      : [];
        const query = Object.assign(Promise.resolve(rows), {
          where: () => query,
          orderBy: () => query,
          limit: async () => rows
        });
        return query;
      }
    }),
    insert: () => ({ values: async () => undefined })
  } as unknown as Tx;
  return {
    tx,
    config: {
      APP_BASE_URL: 'https://dev.kyneticai.com',
      TEST_PHONE: phone,
      OUTBOUND_ENABLED: over.enabled ?? true
    },
    now: midday,
    send: vi.fn(async () => ({ conversationId: 'DEV-synthetic-conversation' })),
    schedule: vi.fn(async (_retry: DevRetry) => undefined)
  };
}
describe('real server consent/outbound gates block the send', () => {
  it('blocks missing consent before the sender', async () => {
    const f = fixture({ consent: false });
    expect(await runDevAttempt(ctx, job, f)).toMatchObject({
      status: 'blocked',
      reason: 'no_consent'
    });
    expect(f.send).not.toHaveBeenCalled();
  });
  it.each([{ enabled: false }, { tenantKill: true }])(
    'global/tenant kill switch blocks the sender %j',
    async (switches) => {
      const f = fixture(switches);
      expect(await runDevAttempt(ctx, job, f)).toMatchObject({
        status: 'deferred',
        reason: 'outbound_disabled'
      });
      expect(f.send).not.toHaveBeenCalled();
      expect(f.schedule).toHaveBeenCalledOnce();
    }
  );
  it('quiet hours defer without incrementing the attempt or sending', async () => {
    const f = fixture();
    f.now = new Date('2026-11-05T06:00:00Z');
    const result = await runDevAttempt(ctx, job, f);
    expect(result).toMatchObject({
      status: 'deferred',
      reason: 'quiet_hours',
      job: { attempt: 1 }
    });
    expect(f.send).not.toHaveBeenCalled();
  });
  it('rejects persisted destinations different from TEST_PHONE', async () => {
    const f = fixture({ phone: 'untrusted-destination' });
    await expect(runDevAttempt(ctx, job, f)).rejects.toThrow('destination mismatch');
    expect(f.send).not.toHaveBeenCalled();
  });
  it('has no default dispatcher even when a gate allows', async () => {
    const f = fixture();
    expect(await runDevAttempt(ctx, job, { ...f, send: undefined })).toMatchObject({
      status: 'dispatch_disabled'
    });
    expect(f.send).not.toHaveBeenCalled();
  });
  it('schedules transient retry with a stable key, never an immediate second dial', async () => {
    const f = fixture();
    f.send.mockRejectedValue(new ProviderError('transient', 'unavailable', 'Synthetic failure'));
    expect(await runDevAttempt(ctx, job, f)).toMatchObject({
      status: 'deferred',
      reason: 'provider_transient',
      job: { attempt: 2 }
    });
    expect(f.send).toHaveBeenCalledOnce();
    expect(f.schedule.mock.calls[0][0]).toMatchObject({ at: new Date(midday.getTime() + 90_000) });
  });
  it('never retries a third attempt or a permanent/config failure', async () => {
    for (const kind of ['transient', 'permanent', 'config'] as const) {
      const f = fixture();
      f.send.mockRejectedValue(new ProviderError(kind, 'synthetic', 'Synthetic failure'));
      await expect(runDevAttempt(ctx, { ...job, attempt: 3 }, f)).rejects.toThrow(
        'Synthetic failure'
      );
      expect(f.schedule).not.toHaveBeenCalled();
    }
  });
});
