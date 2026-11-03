import { describe, expect, it } from 'vitest';
import { buildCsp, securityHeaders } from '@/server/security/headers';

describe('security headers (SECURITY 5.2)', () => {
  it('sets a nonce-based CSP with no unsafe-inline or eval for scripts in production', () => {
    const csp = buildCsp('abc123', false);
    const script = csp.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(script).toContain(`'nonce-abc123'`);
    expect(script).not.toContain('unsafe-inline');
    expect(script).not.toContain('unsafe-eval');
    for (const d of [`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`])
      expect(csp).toContain(d);
  });

  it('allows eval only in development', () => {
    expect(buildCsp('n', true)).toContain(`'unsafe-eval'`);
  });

  it('adds HSTS, nosniff, referrer and permissions policies', () => {
    const h = securityHeaders('n', false);
    expect(h['Strict-Transport-Security']).toMatch(/max-age=\d+; includeSubDomains/);
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toContain('camera=()');
    expect(h['X-Frame-Options']).toBe('DENY');
  });
});
