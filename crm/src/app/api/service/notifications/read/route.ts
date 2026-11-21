import { errorResponse } from '@/server/errors';
import { markServiceNotificationsRead } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Marks the owner's unread notifications read. Requires an Idempotency-Key header and no body.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const result = await runIdempotent(svc, request, '', async (tx) => {
        const data = await markServiceNotificationsRead(tx, svc);
        await auditService(tx, svc, {
          action: 'service.notifications_read',
          entity: 'notification',
          after: { route: 'POST /api/service/notifications/read', marked: data.marked }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'notifications:read' }
);
