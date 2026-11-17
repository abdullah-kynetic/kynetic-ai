import { errorResponse } from '@/server/errors';
import { dealListSchema, listDealsDto, usedFilters } from '@/server/service-api';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Deal titles usually contain the customer's name, so each call writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), dealListSchema);
      const page = await withServiceTenant(svc, async (tx) => {
        const result = await listDealsDto(tx, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'deals',
          after: {
            route: 'GET /api/service/deals',
            filters: usedFilters(q),
            returned: result.items.length
          }
        });
        return result;
      });
      return Response.json(
        { ok: true, data: page.items, nextCursor: page.nextCursor },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);
