import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/server/env';

const valid = {
  NODE_ENV: 'test',
  APP_BASE_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  DATABASE_URL_AUTH: 'postgres://a:p@localhost:5432/db',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  APP_ENCRYPTION_KEY: 'y'.repeat(32)
};

describe('F-87 env validation', () => {
  it('accepts a complete environment and defaults the kill switch to off', () => {
    const env = parseEnv(valid);
    expect(env.OUTBOUND_ENABLED).toBe(false);
    expect(env.DEV_PERSONA_SWITCHING).toBe(false);
  });

  it('forces persona switching off in production even when the flag is set', () => {
    expect(
      parseEnv({ ...valid, NODE_ENV: 'production', DEV_PERSONA_SWITCHING: 'true' })
        .DEV_PERSONA_SWITCHING
    ).toBe(false);
    expect(parseEnv({ ...valid, DEV_PERSONA_SWITCHING: 'true' }).DEV_PERSONA_SWITCHING).toBe(true);
  });

  it('refuses a missing variable and names it without echoing values', () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('refuses a short secret without printing it', () => {
    try {
      parseEnv({ ...valid, BETTER_AUTH_SECRET: 'short' });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toMatch(/BETTER_AUTH_SECRET/);
      expect(String(e)).not.toContain('short');
    }
  });

  it('requires the two Google credentials together', () => {
    expect(() => parseEnv({ ...valid, GOOGLE_CLIENT_ID: 'id' })).toThrow(/GOOGLE_CLIENT_ID/);
    expect(parseEnv({ ...valid, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' })).toBeTruthy();
  });
});
