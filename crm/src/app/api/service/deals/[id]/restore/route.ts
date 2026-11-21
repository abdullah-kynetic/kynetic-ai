import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { restoreServiceDeal } from '@/server/service-api';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Undo a soft delete. Requires an Idempotency-Key header and no body.
export const POST = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const result = await runIdempotent(svc, request, '', async (tx) => {
        const data = await restoreServiceDeal(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.deal_restore',
          entity: 'deal',
          entityId: id,
          after: { route: 'POST /api/service/deals/{id}/restore' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
