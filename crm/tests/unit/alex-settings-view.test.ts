import { describe, expect, it } from 'vitest';
import { clientAlexUpdateSchema, toSettingsView, type AlexConfig } from '@/server/alex';

const row: AlexConfig = {
  tenantId: 't',
  provider: 'elevenlabs',
  agentRef: 'agent_x',
  voice: 'v',
  promptVersion: 2,
  greeting: 'Hello',
  questions: [],
  bookingRules: {},
  callWindows: {},
  retry: { per_day: 3 },
  transferNumberE164: null,
  paused: true,
  updatedBy: null,
  updatedAt: '2026-10-26T00:00:00Z'
};

describe('toSettingsView', () => {
  it('allow-lists fields', () => {
    const view = toSettingsView({ ...row, extra: 'leak' } as AlexConfig);
    expect(view).toEqual({
      greeting: 'Hello',
      questions: [],
      bookingRules: {},
      callWindows: {},
      transferNumber: null,
      paused: true,
      updatedAt: '2026-10-26T00:00:00Z'
    });
  });
  it('tolerates malformed jsonb', () => {
    const view = toSettingsView({ ...row, questions: {}, callWindows: [] } as AlexConfig);
    expect(view.questions).toEqual([]);
    expect(view.callWindows).toEqual({});
  });
});

describe('clientAlexUpdateSchema', () => {
  it('accepts pause and call hours only', () => {
    expect(clientAlexUpdateSchema.safeParse({ paused: true }).success).toBe(true);
    expect(
      clientAlexUpdateSchema.safeParse({ callWindows: { start: '09:00', end: '17:00' } }).success
    ).toBe(true);
    for (const bad of [
      {},
      { greeting: 'x' },
      { paused: true, provider: 'x' },
      { callWindows: { start: '18:00', end: '09:00' } }
    ]) {
      expect(clientAlexUpdateSchema.safeParse(bad).success).toBe(false);
    }
  });
});
