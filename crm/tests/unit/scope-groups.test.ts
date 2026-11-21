import { describe, expect, it } from 'vitest';
import { SCOPE_GROUPS, SCOPE_PRESETS } from '@/server/service-auth/scope-groups';
import { SERVICE_TOKEN_SCOPES } from '@/server/service-auth/scopes';

describe('scope groups', () => {
  it('puts every scope in exactly one group', () => {
    const all = SCOPE_GROUPS.flatMap((g) => g.scopes);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...SERVICE_TOKEN_SCOPES].sort());
  });
  it('presets only use real scopes; read only has no write scope', () => {
    for (const p of SCOPE_PRESETS)
      for (const s of p.scopes) expect(SERVICE_TOKEN_SCOPES).toContain(s);
    const readOnly = SCOPE_PRESETS.find((p) => p.id === 'read-only')!;
    expect(readOnly.scopes.some((s) => s.endsWith(':write') || s.endsWith('-write'))).toBe(false);
    expect(readOnly.scopes).not.toContain('create-contact');
    expect(readOnly.scopes).not.toContain('update-deal-stage');
    expect(readOnly.scopes).not.toContain('event-ack');
  });
});
