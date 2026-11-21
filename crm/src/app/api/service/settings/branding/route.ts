import { errorResponse } from '@/server/errors';
import { getServiceBranding, patchServiceBranding, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Business name and brand color. Logo upload is not part of the service API yet.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const row = await getServiceBranding(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'tenant',
          after: { route: 'GET /api/service/settings/branding' }
        });
        return row;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

// Body: { "name"?: "...", "primaryColor"?: "#rrggbb" | null }. Requires an Idempotency-Key.
export const PATCH = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await patchServiceBranding(tx, svc, json);
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
