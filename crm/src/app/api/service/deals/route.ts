import { errorResponse } from '@/server/errors';
import {
  createServiceDeal,
  dealListSchema,
  listDealsDto,
  readJsonBody,
  usedFilters
} from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
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

// Creates one deal. Requires an Idempotency-Key header.

export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceDeal(tx, svc, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.deal_create',
          entity: 'deal',
          entityId: data.id,
          after: { route: 'POST /api/service/deals' }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
