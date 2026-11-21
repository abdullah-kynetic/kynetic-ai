import { errorResponse } from '@/server/errors';
import { deleteServiceDocument } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Soft delete. Requires an Idempotency-Key header and no body.
export const DELETE = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const result = await runIdempotent(svc, request, '', async (tx) => {
        const data = await deleteServiceDocument(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.document_delete',
          entity: 'document',
          entityId: data.id,
          after: { route: 'DELETE /api/service/documents/{id}' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'documents:write' }
);
