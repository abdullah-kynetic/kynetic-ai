import { errorResponse } from '@/server/errors';
import { getServiceAgencyOps, readJsonBody, saveServiceAgencyOps } from '@/server/service-api';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Ops draft settings (DEV lead-hook URL, workflow name and id). Draft metadata only: the API never
// configures or calls n8n.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const ops = await getServiceAgencyOps(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'agency_ops',
          after: { route: 'GET /api/service/agency/ops' }
        });
        return ops;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

// Body: { "devWebhookUrl", "workflowName", "workflowId" }. Idempotency-Key required.
export const PUT = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        await saveServiceAgencyOps(tx, svc, json);
        return { status: 200, body: { ok: true, data: { saved: true } } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
