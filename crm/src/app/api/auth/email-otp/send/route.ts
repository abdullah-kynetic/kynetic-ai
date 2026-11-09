import { sendSignInCode, getAuth } from '@/server/auth';
import { requestEmailOtp } from '@/server/auth/email-otp';
import { enforceAuthRequestRateLimits } from '@/server/auth/rate-limit';
import { getAuthDb } from '@/server/db/client';
import { getEnv } from '@/server/env';
import { errorResponse } from '@/server/errors';
import { emailSchema, parseJsonBody } from '@/server/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ email: emailSchema }).strict();

export async function POST(request: Request) {
  try {
    await enforceAuthRequestRateLimits(request);
    const { email } = await parseJsonBody(request, bodySchema);
    const env = getEnv();
    const result = await requestEmailOtp(
      {
        db: getAuthDb(),
        secret: env.BETTER_AUTH_SECRET,
        baseUrl: env.APP_BASE_URL,
        auth: getAuth(),
        sendCode: sendSignInCode
      },
      email
    );
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
