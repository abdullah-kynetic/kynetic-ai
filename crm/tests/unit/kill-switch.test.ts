import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tx } from '@/server/db/client';
import type { TenantContextInput } from '@/server/tenancy';
import { canContact } from '@/server/consent';
import { checkOutbound } from '@/server/outbound/gate';

const config = vi.hoisted(() => ({ OUTBOUND_ENABLED: false }));
vi.mock('@/server/env', () => ({ getEnv: () => config }));
vi.mock('@/server/consent', () => ({ canContact: vi.fn() }));

const ctx: TenantContextInput = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  role: 'system',
  readOnly: true
};
const now = new Date('2026-11-04T18:00:00Z');
const contactId = '22222222-2222-4222-8222-222222222222';

// Only the configuration rows selected before consent. No database or provider is used.
function transaction(rows: unknown[][]) {
  const limit = vi.fn();
  for (const result of rows) limit.mockResolvedValueOnce(result);
  const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) }));
  return { tx: { select } as unknown as Tx, select, limit };
}

afterEach(() => {
  config.OUTBOUND_ENABLED = false;
  vi.clearAllMocks();
});

describe('F-78 outbound kill switches', () => {
  it.each(['phone_call', 'sms', 'email'] as const)(
    'global disabled switch blocks %s before consent or tenant configuration',
    async (channel) => {
      const { tx, select } = transaction([]);
      expect(
        await checkOutbound(ctx, { contactId, channel, module: 'alex_core' }, now, { tx })
      ).toEqual({ allowed: false, reason: 'outbound_disabled' });
      expect(select).not.toHaveBeenCalled();
      expect(canContact).not.toHaveBeenCalled();
    }
  );

  it('blocks an inbound SMS reply even when the consent bypass was requested', async () => {
    const { tx } = transaction([]);
    expect(
      await checkOutbound(ctx, { contactId, channel: 'sms', module: 'alex_core' }, now, {
        tx,
        replyToInbound: true
      })
    ).toEqual({ allowed: false, reason: 'outbound_disabled' });
    expect(canContact).not.toHaveBeenCalled();
  });

  it('checks the tenant switch when the global switch allows outbound', async () => {
    config.OUTBOUND_ENABLED = true;
    const { tx, limit } = transaction([
      [{ status: 'active' }],
      [{ config: { outbound_kill_switch: true } }]
    ]);
    expect(
      await checkOutbound(ctx, { contactId, channel: 'phone_call', module: 'alex_core' }, now, {
        tx
      })
    ).toEqual({ allowed: false, reason: 'outbound_disabled' });
    expect(limit).toHaveBeenCalledTimes(2);
    expect(canContact).not.toHaveBeenCalled();
  });

  it('does not turn off module protection when the tenant kill switch is clear', async () => {
    const { tx } = transaction([
      [{ status: 'active' }],
      [{ config: { outbound_kill_switch: false } }],
      [{ enabled: false }]
    ]);
    expect(
      await checkOutbound(ctx, { contactId, channel: 'phone_call', module: 'alex_core' }, now, {
        tx,
        outboundEnabled: true
      })
    ).toEqual({ allowed: false, reason: 'module_off' });
    expect(canContact).not.toHaveBeenCalled();
  });
});
