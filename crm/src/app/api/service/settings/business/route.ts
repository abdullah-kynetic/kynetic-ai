import { errorResponse } from '@/server/errors';
import { getServiceBusiness, patchServiceBusiness, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// The business profile: timezone, hours, service area, services and transfer number.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const row = await getServiceBusiness(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'tenant',
          after: { route: 'GET /api/service/settings/business' }
        });
        return row;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

// Edits the fields sent. Requires an Idempotency-Key header. Plan and status cannot be sent.
export const PATCH = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await patchServiceBusiness(tx, svc, json as Record<string, unknown>);
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
