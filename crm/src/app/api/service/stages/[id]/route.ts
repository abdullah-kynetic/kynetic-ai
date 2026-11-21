import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { deleteServiceStage, readJsonBody, updateServiceStage } from '@/server/service-api';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Edits one stage. Requires an Idempotency-Key header.
export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await updateServiceStage(tx, svc, id, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.stage_update',
          entity: 'stage',
          entityId: id,
          after: { route: 'PATCH /api/service/stages/{id}' }
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

// Deletes one stage. Refused while deals remain on it. Requires an Idempotency-Key header and no body.
export const DELETE = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const result = await runIdempotent(svc, request, '', async (tx) => {
        const data = await deleteServiceStage(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.stage_delete',
          entity: 'stage',
          entityId: id,
          after: { route: 'DELETE /api/service/stages/{id}' }
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
