import { errorResponse } from '@/server/errors';
import {
  createServiceAgencyLead,
  listServiceAgencyLeads,
  readJsonBody
} from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Agency leads, admin key only. Each read is audited.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const query = Object.fromEntries(new URL(request.url).searchParams.entries());
      const data = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceAgencyLeads(tx, svc, query);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'agency_lead',
          after: { route: 'GET /api/service/agency/leads' }
        });
        return rows;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);

// Idempotency-Key required.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceAgencyLead(tx, svc, json);
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
