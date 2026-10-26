// Response security headers (SECURITY 5.2). Set by src/proxy.ts on every page and API response.
// The CSP is nonce-based: no unsafe-inline scripts. Final values are re-verified in M10.

export function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    `default-src 'self'`,
    // strict-dynamic lets nonce'd scripts load their chunks; the host allowlist is ignored by browsers that support it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? ` 'unsafe-eval'` : ''}`,
    // Tailwind and component libraries set inline style attributes; scripts are what the nonce protects.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'${isDev ? ' ws:' : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : [`upgrade-insecure-requests`])
  ];
  return directives.join('; ');
}

export function securityHeaders(nonce: string, isDev: boolean): Record<string, string> {
  return {
    'Content-Security-Policy': buildCsp(nonce, isDev),
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  };
}

export function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}
