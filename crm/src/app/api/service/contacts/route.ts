import { errorResponse } from '@/server/errors';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { contactListSchema, listContactsDto, usedFilters } from '@/server/service-api';
import { parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Newest-updated first, keyset paged. Names and tags only: no phone or email in a list. Personal data
// is returned, so each call writes a `service.read` audit row (filter names and count, never values).
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), contactListSchema);
      const page = await withServiceTenant(svc, async (tx) => {
        const result = await listContactsDto(tx, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'contacts',
          after: {
            route: 'GET /api/service/contacts',
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
  { requiredScope: 'contacts:read' }
);
