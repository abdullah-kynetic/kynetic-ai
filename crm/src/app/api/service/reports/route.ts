import { errorResponse } from '@/server/errors';
import { listServiceReports } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// The tenant's monthly reports, oldest period first. Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceReports(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'report',
          after: { route: 'GET /api/service/reports' }
        });
        return rows;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'reports:read' }
);
