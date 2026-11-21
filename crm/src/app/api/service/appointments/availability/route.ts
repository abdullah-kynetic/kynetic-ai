import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { getServiceAvailability, serviceAvailabilityQuerySchema } from '@/server/service-api';
import { parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Free slots in business hours for a window. Read only; writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), serviceAvailabilityQuerySchema);
      const data = await withServiceTenant(svc, async (tx) => {
        const result = await getServiceAvailability(tx, svc, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'appointments',
          after: {
            route: 'GET /api/service/appointments/availability',
            returned: result.slots.length
          }
        });
        return result;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'appointments:read' }
);
