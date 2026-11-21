import { errorResponse } from '@/server/errors';
import {
  createServiceAgencyProspect,
  listServiceAgencyProspects,
  readJsonBody
} from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Agency prospects, admin key only. Query: stage, q, source, state (two letters). Each read is audited.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const url = new URL(request.url);
      const query = Object.fromEntries(url.searchParams.entries());
      const data = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceAgencyProspects(tx, svc, query);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'agency_prospect',
          after: { route: 'GET /api/service/agency/prospects', returned: rows.length }
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

// Idempotency-Key required. Florida and Oklahoma owners are refused by the portal's schema.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceAgencyProspect(tx, svc, json);
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
