import { errorResponse } from '@/server/errors';
import { listServiceAutomations } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Automation templates with their state. Each read is audited.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceAutomations(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'automation',
          after: { route: 'GET /api/service/settings/automations' }
        });
        return rows;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);
