import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/server/env';
import { errorBody } from '@/server/errors';
import { newNonce, securityHeaders } from '@/server/security/headers';
import { getVerifiedSessionUser } from '@/server/auth';
import { decideAdminAccess } from '@/server/admin/guard';
import { isOriginAllowed } from '@/server/security/origin';

// Runs before every page and API request: Origin check for state-changing requests (server
// actions are POSTs to their page), then CSP nonce and security headers (SECURITY 2.1, 5.2).
export async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const nonce = newNonce();
  const headers = securityHeaders(nonce, isDev);

  const allowed = isOriginAllowed({
    method: request.method,
    pathname: request.nextUrl.pathname,
    origin: request.headers.get('origin'),
    appOrigin: new URL(getEnv().APP_BASE_URL).origin
  });
  if (!allowed) {
    return NextResponse.json(errorBody('FORBIDDEN', 'Request origin not allowed.'), {
      status: 403,
      headers: { ...headers, 'Cache-Control': 'no-store' }
    });
  }

  const path = request.nextUrl.pathname;
  if (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/api/admin' ||
    path.startsWith('/api/admin/')
  ) {
    const access = await decideAdminAccess(request.headers);
    if (access.kind !== 'ok') {
      const code = access.kind === 'sign_in' ? 'UNAUTHENTICATED' : 'FORBIDDEN';
      return NextResponse.json(errorBody(code), {
        status: access.kind === 'sign_in' ? 401 : 403,
        headers: { ...headers, 'Cache-Control': 'no-store' }
      });
    }
  }

  if (path === '/dashboard' || path.startsWith('/dashboard/')) {
    const user = await getVerifiedSessionUser(request.headers);
    if (!user) return NextResponse.redirect(new URL('/sign-in', request.url), 307);
    if (user.twoFactor === 'enrol' || user.twoFactor === 'challenge') {
      return NextResponse.redirect(new URL('/staff/2fa', request.url), 307);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', headers['Content-Security-Policy']);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'
    }
  ]
};
