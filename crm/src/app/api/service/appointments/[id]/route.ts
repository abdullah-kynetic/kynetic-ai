import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';
import {
  getServiceAppointment,
  readJsonBody,
  rescheduleServiceAppointment
} from '@/server/service-api';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// One appointment. Reads write a `service.read` audit row.
export const GET = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const data = await withServiceTenant(svc, async (tx) => {
        const row = await getServiceAppointment(tx, id);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'appointment',
          entityId: id,
          after: { route: 'GET /api/service/appointments/{id}' }
        });
        return row;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'appointments:read' }
);

// Reschedule: new start and end, checked against business hours and calendar clashes. Requires an
// Idempotency-Key header.
export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await rescheduleServiceAppointment(
          tx,
          svc,
          id,
          json as Record<string, unknown>
        );
        await auditService(tx, svc, {
          action: 'service.appointment_reschedule',
          entity: 'appointment',
          entityId: id,
          after: { route: 'PATCH /api/service/appointments/{id}' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'appointments:write' }
);
