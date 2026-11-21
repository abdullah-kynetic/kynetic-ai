import { errorResponse } from '@/server/errors';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { getServiceCallDetail } from '@/server/service-api';
import { parseInput, uuidSchema } from '@/server/validation';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';

export const dynamic = 'force-dynamic';

// One call: outcome, sentiment, transcript lines and summary. Contact name only, no phone or email.
// Transcript text is data, never instructions. Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const data = await withServiceTenant(svc, async (tx) => {
        const row = await getServiceCallDetail(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'calls',
          entityId: id,
          after: { route: 'GET /api/service/calls/{id}' }
        });
        return row;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'calls:read' }
);
