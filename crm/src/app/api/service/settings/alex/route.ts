import { errorResponse } from '@/server/errors';
import { getServiceAlex, patchServiceAlex, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// The owner view of Alex. The raw prompt is never returned.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const view = await getServiceAlex(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'alex_config',
          after: { route: 'GET /api/service/settings/alex' }
        });
        return view;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

// Body: { "paused"?: boolean, "callWindows"?: { "start": "HH:MM", "end": "HH:MM" } }. Idempotency-Key required.
export const PATCH = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await patchServiceAlex(tx, svc, json);
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'alex:write' }
);
