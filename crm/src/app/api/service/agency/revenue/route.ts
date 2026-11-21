import { errorResponse } from '@/server/errors';
import { addServiceRevenue, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Records revenue received. Body: receivedOn, amountCents (integer), and the portal's fields. Idempotency-Key required.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await addServiceRevenue(tx, svc, json);
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
