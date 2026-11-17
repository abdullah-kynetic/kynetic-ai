import { errorResponse } from '@/server/errors';
import { taskListSchema, listTasksDto, usedFilters } from '@/server/service-api';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Read only. Each call writes a `service.read` audit row (token id, route, filter names, count).
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), taskListSchema);
      const page = await withServiceTenant(svc, async (tx) => {
        const result = await listTasksDto(tx, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'tasks',
          after: {
            route: 'GET /api/service/tasks',
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
  { requiredScope: 'tasks:read' }
);
