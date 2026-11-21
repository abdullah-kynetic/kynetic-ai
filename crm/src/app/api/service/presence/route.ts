import { errorResponse } from '@/server/errors';
import { listServicePresence } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Presence items and review snapshots. Owner's admin key only; each read writes a `service.read` row.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const result = await listServicePresence(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'presence',
          after: { route: 'GET /api/service/presence', returned: result.items.length }
        });
        return result;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'reputation:read' }
);
