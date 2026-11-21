import { errorResponse } from '@/server/errors';
import { moveServiceProspectsToSales, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Body: { "ids": ["uuid", ...] } (1 to 100). Prospects on the do-not-call list are skipped with a reason.
// Creates sales leads only; nothing is sent. Idempotency-Key required.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const ids = (json as { ids?: unknown } | null)?.ids;
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await moveServiceProspectsToSales(tx, svc, ids);
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
