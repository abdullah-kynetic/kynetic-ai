import { errorResponse } from '@/server/errors';
import { readJsonBody, saveServicePresence } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth } from '@/server/service-auth';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Updates one presence item. Owner's admin key only. Requires an Idempotency-Key header.
export const PUT = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await saveServicePresence(tx, svc, id, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.presence_update',
          entity: 'presence_item',
          entityId: id,
          after: { route: 'PUT /api/service/presence/{id}' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'reputation:write' }
);
