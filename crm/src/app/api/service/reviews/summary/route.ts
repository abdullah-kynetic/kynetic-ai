import { errorResponse } from '@/server/errors';
import { getServiceReviewSummary } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Review counts, ratings and trend for the client's review sites. Range is 90d (default) or 12m.
// Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const range = new URL(request.url).searchParams.get('range') ?? undefined;
      const data = await withServiceTenant(svc, async (tx) => {
        const summary = await getServiceReviewSummary(tx, svc, range);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'reviews',
          after: { route: 'GET /api/service/reviews/summary', range: range ?? '90d' }
        });
        return summary;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'reputation:read' }
);
