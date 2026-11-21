import { errorResponse } from '@/server/errors';
import { listServiceNotifications } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// The owner's notifications and the unread count. `unread=1` lists unread only; `limit` is 1 to 100.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const url = new URL(request.url);
      const limitRaw = url.searchParams.get('limit');
      const data = await withServiceTenant(svc, async (tx) => {
        const result = await listServiceNotifications(tx, svc, {
          unreadOnly: url.searchParams.get('unread') === '1',
          limit: limitRaw === null ? undefined : Number(limitRaw),
          before: url.searchParams.get('before') ?? undefined
        });
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'notification',
          after: { route: 'GET /api/service/notifications' }
        });
        return result;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'notifications:read' }
);
