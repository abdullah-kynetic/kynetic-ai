import { errorResponse } from '@/server/errors';
import {
  createServiceAgencyContract,
  listServiceAgencyContracts,
  readJsonBody
} from '@/server/service-api';
import {
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Contracts, optional ?status= and ?stageId=. Admin key only.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const sp = new URL(request.url).searchParams;
      const filter = {
        ...(sp.get('status') ? { status: sp.get('status')! } : {}),
        ...(sp.get('stageId') ? { stageId: sp.get('stageId')! } : {})
      };
      const data = await withServiceTenant(svc, (tx) =>
        listServiceAgencyContracts(tx, svc, filter)
      );
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);

// Body: { "dealId": "uuid", "title": "..." }. Idempotency-Key required.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceAgencyContract(tx, svc, json);
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
