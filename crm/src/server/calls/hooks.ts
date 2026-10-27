import { ProviderError } from '../adapters/errors';
import type { VoiceProvider } from '../adapters/voice/types';
import { ingestWebhook } from '../webhooks';
import type { VoiceEventPayload } from './process';

// Route body for POST /api/hooks/voice/:provider (ARCHITECTURE section 5, SECURITY 3.6). The raw
// body is read before parsing; a bad signature stores nothing and answers 401 with no detail.

export async function handleVoiceWebhook(
  request: Request,
  deps: { provider: VoiceProvider }
): Promise<Response> {
  const raw = await request.text();
  let event: ReturnType<VoiceProvider['parseWebhook']>;
  try {
    event = deps.provider.parseWebhook(Object.fromEntries(request.headers.entries()), raw);
  } catch (e) {
    if (e instanceof ProviderError) {
      if (e.code === 'bad_signature') return new Response(null, { status: 401 });
      // Events we do not act on (such as audio-only) are acknowledged so the provider stops retrying.
      if (e.code === 'unsupported_event') return new Response(null, { status: 200 });
      return new Response(null, { status: 400 });
    }
    throw e;
  }
  const payload: VoiceEventPayload = { ...event, startedAt: event.startedAt.toISOString() };
  // A replay is also a 200 so the provider stops retrying.
  await ingestWebhook({
    source: deps.provider.id,
    externalId: event.externalId,
    payload,
    verify: () => true
  });
  return new Response(null, { status: 200 });
}
