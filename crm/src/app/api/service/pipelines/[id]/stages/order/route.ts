import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { readJsonBody, reorderServiceStages } from '@/server/service-api';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Sets the order of one pipeline's stages. All or nothing. Requires an Idempotency-Key header.
export const PUT = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await reorderServiceStages(tx, svc, id, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.stage_reorder',
          entity: 'pipeline',
          entityId: id,
          after: { route: 'PUT /api/service/pipelines/{id}/stages/order' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'pipeline:write' }
);
