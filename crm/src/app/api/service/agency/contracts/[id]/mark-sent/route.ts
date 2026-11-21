import { errorResponse } from '@/server/errors';
import { markServiceContractSent, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Records that a contract was sent. The API does not email it. Body: { "sentOn": "YYYY-MM-DD" }.
export const POST = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await markServiceContractSent(tx, svc, id, json);
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
