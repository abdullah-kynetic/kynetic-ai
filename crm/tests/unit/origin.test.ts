import { describe, expect, it } from 'vitest';
import { assertSameOrigin, isOriginAllowed } from '@/server/security/origin';

const appOrigin = 'https://app.example.test';
const base = { pathname: '/api/contacts', appOrigin };

describe('Origin check (SEC-T-32)', () => {
  it('refuses a state-changing request with no Origin', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      expect(isOriginAllowed({ ...base, method, origin: null })).toBe(false);
  });

  it('refuses a foreign Origin, including look-alikes', () => {
    for (const origin of [
      'https://evil.test',
      'https://app.example.test.evil.test',
      'http://app.example.test',
      'null'
    ])
      expect(isOriginAllowed({ ...base, method: 'POST', origin })).toBe(false);
  });

  it('allows our own Origin and safe methods', () => {
    expect(isOriginAllowed({ ...base, method: 'POST', origin: appOrigin })).toBe(true);
    for (const method of ['GET', 'HEAD', 'OPTIONS'])
      expect(isOriginAllowed({ ...base, method, origin: null })).toBe(true);
  });

  it('leaves machine paths to their signature or bearer auth', () => {
    expect(
      isOriginAllowed({ method: 'POST', pathname: '/api/hooks/twilio', origin: null, appOrigin })
    ).toBe(true);
    expect(
      isOriginAllowed({ method: 'POST', pathname: '/api/service/leads', origin: null, appOrigin })
    ).toBe(true);
    expect(
      isOriginAllowed({ method: 'POST', pathname: '/api/hooksy', origin: null, appOrigin })
    ).toBe(false);
  });

  it('assertSameOrigin throws FORBIDDEN', () => {
    const req = new Request('https://app.example.test/api/contacts', { method: 'POST' });
    expect(() => assertSameOrigin(req, 'https://app.example.test')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' })
    );
  });
});
