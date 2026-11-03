import { AppError } from '../errors';

// CSRF defence beyond SameSite=Lax (SECURITY 2.1): every state-changing request must carry an
// Origin header equal to the app's own origin. A missing or foreign Origin is refused.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Machine callers: provider and lead webhooks (signature) and service tokens (bearer). Browsers do
// not call these, and they have their own authentication.
const MACHINE_PREFIXES = ['/api/hooks/', '/api/service/'];

export function isStateChanging(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

export function isMachinePath(pathname: string): boolean {
  return MACHINE_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Returns true when the request may proceed. */
export function isOriginAllowed(req: {
  method: string;
  pathname: string;
  origin: string | null;
  appOrigin: string;
}): boolean {
  if (!isStateChanging(req.method) || isMachinePath(req.pathname)) return true;
  return req.origin !== null && req.origin === req.appOrigin;
}

/** Same check for a route handler or server action that wants to enforce it itself. */
export function assertSameOrigin(request: Request, appBaseUrl: string): void {
  const ok = isOriginAllowed({
    method: request.method,
    pathname: new URL(request.url).pathname,
    origin: request.headers.get('origin'),
    appOrigin: new URL(appBaseUrl).origin
  });
  if (!ok) throw new AppError('FORBIDDEN', { message: 'Request origin not allowed.' });
}
