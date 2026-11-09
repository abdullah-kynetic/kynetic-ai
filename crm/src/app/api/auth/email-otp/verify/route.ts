import { getAuth } from '@/server/auth';
import { verifyEmailOtp } from '@/server/auth/email-otp';
import { enforceAuthRequestRateLimits } from '@/server/auth/rate-limit';
import { getAuthDb } from '@/server/db/client';
import { getEnv } from '@/server/env';
import { errorResponse } from '@/server/errors';
import { emailSchema, parseJsonBody } from '@/server/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    email: emailSchema,
    code: z.string().max(32).optional()
  })
  .strict();

export async function POST(request: Request) {
  try {
    await enforceAuthRequestRateLimits(request);
    const { email, code } = await parseJsonBody(request, bodySchema);
    const env = getEnv();
    const result = await verifyEmailOtp(
      {
        db: getAuthDb(),
        secret: env.BETTER_AUTH_SECRET,
        baseUrl: env.APP_BASE_URL,
        auth: getAuth(),
        sendCode: async () => {}
      },
      email,
      code ?? ''
    );
    const headers = new Headers({ 'cache-control': 'no-store' });
    if (result.ok) headers.append('set-cookie', result.setCookie);
    return Response.json(
      result.ok ? { ok: true, next: result.next } : { ok: false, message: result.message },
      { headers }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
