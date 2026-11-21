import { errorResponse } from '@/server/errors';
import {
  deleteServiceCustomField,
  readJsonBody,
  updateServiceCustomField
} from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Label, options and the show, filter and import flags. Key, type and entity cannot change.
export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await updateServiceCustomField(tx, svc, id, json as never);
        await auditService(tx, svc, {
          action: 'service.custom_field_update',
          entity: 'custom_field',
          entityId: data.id,
          after: { route: 'PATCH /api/service/settings/custom-fields/{id}' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);

// Removes the definition and every stored value of it. Requires an Idempotency-Key and no body.
export const DELETE = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const result = await runIdempotent(svc, request, '', async (tx) => {
        const data = await deleteServiceCustomField(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.custom_field_delete',
          entity: 'custom_field',
          entityId: id,
          after: { route: 'DELETE /api/service/settings/custom-fields/{id}' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
