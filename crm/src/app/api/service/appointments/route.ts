import { errorResponse } from '@/server/errors';
import {
  appointmentListSchema,
  bookServiceAppointment,
  listAppointmentsDto,
  readJsonBody,
  usedFilters
} from '@/server/service-api';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Read only. Each call writes a `service.read` audit row (token id, route, filter names, count).
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), appointmentListSchema);
      const page = await withServiceTenant(svc, async (tx) => {
        const result = await listAppointmentsDto(tx, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'appointments',
          after: {
            route: 'GET /api/service/appointments',
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
  { requiredScope: 'appointments:read' }
);

// Books one appointment. Sends no invite and no text. A clash is a 409 and a time outside business
// hours is a 400. Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await bookServiceAppointment(tx, svc, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.appointment_create',
          entity: 'appointment',
          entityId: data.id,
          after: { route: 'POST /api/service/appointments', status: data.status }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'appointments:write' }
);
