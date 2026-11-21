import { errorResponse } from '@/server/errors';
import { getServiceReport } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// One monthly report. Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (_request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const data = await withServiceTenant(svc, async (tx) => {
        const report = await getServiceReport(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'report',
          entityId: report.id,
          after: { route: 'GET /api/service/reports/{id}' }
        });
        return report;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'reports:read' }
);
