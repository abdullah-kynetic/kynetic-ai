import { NextResponse } from 'next/server';
import { ProviderError } from '@/server/adapters/errors';
import { ResendEmailProvider } from '@/server/adapters/email/resend';
import { getDb } from '@/server/db/client';
import { RESEND_SOURCE } from '@/server/email';
import { getEnv } from '@/server/env';
import { clientIp } from '@/server/security/with-api';
import { enforceRateLimit, RATE_LIMITS } from '@/server/security/rate-limit';
import { errorResponse } from '@/server/errors';
import { ingestWebhook } from '@/server/webhooks';

export const dynamic = 'force-dynamic';

// F-30, F-35: Resend delivery, bounce and complaint events. Signature first, nothing stored on failure.
export async function POST(request: Request) {
  try {
    await enforceRateLimit(
      getDb(),
      RATE_LIMITS.providerWebhookSource,
      `resend:${clientIp(request)}`
    );
    const env = getEnv();
    if (!env.RESEND_WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: { code: 'INTERNAL' } }, { status: 503 });
    }
    const raw = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    const provider = new ResendEmailProvider({
      apiKey: env.RESEND_API_KEY ?? '',
      webhookSecret: env.RESEND_WEBHOOK_SECRET
    });
    let event;
    try {
      event = provider.parseWebhook(headers, raw);
    } catch (e) {
      if (e instanceof ProviderError && e.code === 'ignored_event') {
        return NextResponse.json({ ok: true, ignored: true });
      }
      if (e instanceof ProviderError && e.code === 'bad_signature') {
        return NextResponse.json(
          { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED' } },
        { status: 400 }
      );
    }
    const result = await ingestWebhook({
      source: RESEND_SOURCE,
      externalId: headers['svix-id'] as string, // covered by the signature
      payload: event,
      verify: () => true // parseWebhook already verified
    });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    return errorResponse(err);
  }
}
