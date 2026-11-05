import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/server/auth';
import { errorResponse } from '@/server/errors';
import { enforceAuthRequestRateLimits } from '@/server/auth/rate-limit';

// Better-Auth endpoints: Google callback, magic-link request and verify, sign-out.
export const dynamic = 'force-dynamic';

async function handle(
  request: Request,
  method: (request: Request) => Promise<Response> | Response
): Promise<Response> {
  try {
    await enforceAuthRequestRateLimits(request);
    return await method(request);
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
