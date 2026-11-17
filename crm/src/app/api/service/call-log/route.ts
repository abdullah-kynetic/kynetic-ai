import { errorResponse, ValidationError } from '@/server/errors';
import { callLogSchema, recordCallLog } from '@/server/service-api';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { parseInput } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Records the outcome of a call a human already placed. It never dials, texts or triggers anything.
// Requires an Idempotency-Key header: the same key and body replays the first response.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const raw = await request.text();
      if (raw.length > 8_000) throw new ValidationError({ '': ['too_big'] });
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new ValidationError({ '': ['invalid_json'] });
      }
      const input = parseInput(callLogSchema, json);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await recordCallLog(tx, svc, input);
        await auditService(tx, svc, {
          action: 'service.call_log',
          entity: 'contact',
          entityId: input.contactId,
          after: {
            route: 'POST /api/service/call-log',
            activityId: data.activityId,
            outcome: data.outcome
          }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'call-log:write' }
);
