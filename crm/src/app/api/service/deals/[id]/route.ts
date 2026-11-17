import { errorResponse } from '@/server/errors';
import { getDealDto } from '@/server/service-api';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const GET = withServiceAuth(
  async (_request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const data = await withServiceTenant(svc, async (tx) => {
        const deal = await getDealDto(tx, id);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'deal',
          entityId: id,
          after: { route: 'GET /api/service/deals/{id}' }
        });
        return deal;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);
