import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/server/auth';
import { errorResponse } from '@/server/errors';
import { enforceAuthRequestRateLimits } from '@/server/auth/rate-limit';

// Better-Auth endpoints: Google callback, magic-link request and verify, sign-out, staff TOTP.
export const dynamic = 'force-dynamic';

/** Enrolment must not return backup codes, even if the library still builds them. */
async function stripBackupCodes(request: Request, response: Response): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!path.endsWith('/two-factor/enable') || !response.ok) return response;
  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Response(text, { status: response.status, headers: response.headers });
    }
    data = parsed as Record<string, unknown>;
  } catch {
    return new Response(text, { status: response.status, headers: response.headers });
  }
  if (!('backupCodes' in data)) {
    return new Response(text, { status: response.status, headers: response.headers });
  }
  delete data.backupCodes;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify(data), { status: response.status, headers });
}

async function handle(
  request: Request,
  method: (request: Request) => Promise<Response> | Response
): Promise<Response> {
  try {
    await enforceAuthRequestRateLimits(request);
    return await stripBackupCodes(request, await method(request));
  } catch (error) {
    return errorResponse(error);
  }
}

export function GET(request: Request) {
  return handle(request, toNextJsHandler(getAuth()).GET);
}

export function POST(request: Request) {
  return handle(request, toNextJsHandler(getAuth()).POST);
}
