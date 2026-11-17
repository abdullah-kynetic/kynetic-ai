import { errorResponse, ValidationError } from '@/server/errors';
import { moveServiceDeal, serviceDealStageSchema } from '@/server/service-api';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Moves one deal to a stage of its own pipeline. A deal or stage of another tenant or pipeline is a 404
// with nothing written. The change is tagged origin: 'service-api', so nothing outbound runs for it
// (n8n push, quote follow-up, won alert). Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const raw = await request.text();
      if (raw.length > 5_000) throw new ValidationError({ '': ['too_big'] });
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new ValidationError({ '': ['invalid_json'] });
      }
      const input = parseInput(serviceDealStageSchema, json);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await moveServiceDeal(tx, svc, id, input);
        await auditService(tx, svc, {
          action: 'service.deal_stage',
          entity: 'deal',
          entityId: id,
          after: {
            route: 'POST /api/service/deals/{id}/stage',
            fromStageId: data.fromStageId,
            toStageId: data.toStageId,
            changed: data.changed
          }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
