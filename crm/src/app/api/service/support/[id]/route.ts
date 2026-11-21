import { errorResponse } from '@/server/errors';
import { getServiceSupportThread } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// One request and its replies. Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (_request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const data = await withServiceTenant(svc, async (tx) => {
        const thread = await getServiceSupportThread(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'support_request',
          entityId: thread.id,
          after: { route: 'GET /api/service/support/{id}' }
        });
        return thread;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'support:read' }
);
