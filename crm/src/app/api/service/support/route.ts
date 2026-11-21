import { errorResponse } from '@/server/errors';
import { createServiceSupport, listServiceSupport, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// The client's support requests, newest first. Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceSupport(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'support_request',
          after: { route: 'GET /api/service/support' }
        });
        return rows;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'support:read' }
);

// Opens a request. Requires an Idempotency-Key header. Alerts Kynetic in-app only.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceSupport(tx, svc, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'support.submit',
          entity: 'support_request',
          entityId: data.id,
          after: { route: 'POST /api/service/support', category: data.category }
        });
        return { status: 201, body: { ok: true, data: { id: data.id } } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'support:write' }
);
