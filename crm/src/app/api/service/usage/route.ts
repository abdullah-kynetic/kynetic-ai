import { errorResponse } from '@/server/errors';
import { getServiceUsage } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Client usage for one month (YYYY-MM; default this month). Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const month = new URL(request.url).searchParams.get('month') ?? undefined;
      const data = await withServiceTenant(svc, async (tx) => {
        const usage = await getServiceUsage(tx, svc, month);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'usage',
          after: { route: 'GET /api/service/usage', month: month ?? 'current' }
        });
        return usage;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'usage:read' }
);
