import { errorResponse } from '@/server/errors';
import {
  createServiceAgencyCampaign,
  listServiceAgencyCampaigns,
  readJsonBody
} from '@/server/service-api';
import {
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Campaigns. Creating a draft is allowed; starting, advancing and sending are held (Tier B).
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, (tx) => listServiceAgencyCampaigns(tx, svc));
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);

// Body: { "name": "...", "script": "..." }. Idempotency-Key required.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceAgencyCampaign(tx, svc, json);
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
