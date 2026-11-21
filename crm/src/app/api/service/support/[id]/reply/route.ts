import { errorResponse } from '@/server/errors';
import { readJsonBody, replyServiceSupport } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Adds a client reply to a request. Requires an Idempotency-Key header. Nothing is emailed.
export const POST = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await replyServiceSupport(tx, svc, id, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'support.reply',
          entity: 'support_request',
          entityId: data.requestId,
          after: {
            route: 'POST /api/service/support/{id}/reply',
            side: 'client',
            messageId: data.id
          }
        });
        return { status: 201, body: { ok: true, data: { id: data.id } } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'support:write' }
);
