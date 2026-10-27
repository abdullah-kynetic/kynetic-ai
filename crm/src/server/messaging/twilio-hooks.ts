import type { SmsProvider } from '../adapters/sms/types';
import { ProviderError } from '../adapters/errors';
import { ingestWebhook } from '../webhooks';
import { TWILIO_SOURCE, type TwilioEventPayload } from './twilio-events';

// Route bodies for POST /api/hooks/twilio/status and /inbound (ARCHITECTURE section 5). The raw
// body is read before parsing; a bad signature stores nothing and answers 401 with no detail.

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

type Deps = { provider: SmsProvider };

function headersOf(request: Request): Record<string, string> {
  return Object.fromEntries(request.headers.entries());
}

async function handle(
  request: Request,
  deps: Deps,
  parse: (
    headers: Record<string, string>,
    raw: string
  ) => { externalId: string; payload: TwilioEventPayload }
): Promise<Response> {
  const raw = await request.text();
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(headersOf(request), raw);
  } catch (e) {
    if (e instanceof ProviderError) {
      const status = e.code === 'bad_signature' ? 401 : 400;
      return new Response(null, { status });
    }
    throw e;
  }
  await ingestWebhook({
    source: TWILIO_SOURCE,
    externalId: parsed.externalId,
    payload: parsed.payload,
    verify: () => true
  });
  // A replay is also a 200 so Twilio stops retrying.
  return new Response(EMPTY_TWIML, { status: 200, headers: { 'Content-Type': 'text/xml' } });
}

export function handleTwilioStatus(request: Request, deps: Deps): Promise<Response> {
  return handle(request, deps, (h, raw) => {
    const event = deps.provider.parseStatusCallback(h, raw);
    return {
      externalId: `${event.providerId}:${event.status}`,
      payload: { kind: 'status', event }
    };
  });
}

export function handleTwilioInbound(request: Request, deps: Deps): Promise<Response> {
  return handle(request, deps, (h, raw) => {
    const event = deps.provider.parseInbound(h, raw);
    return { externalId: event.providerId, payload: { kind: 'inbound', event } };
  });
}
