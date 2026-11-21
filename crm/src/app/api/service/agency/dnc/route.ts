import { errorResponse } from '@/server/errors';
import { markServiceAgencyDnc, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Body: { "contactId": "uuid" }. Permanent: the contact goes on the do-not-call list. Idempotency-Key required.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await markServiceAgencyDnc(tx, svc, json);
        return { status: 200, body: { ok: true, data: data ?? { marked: true } } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
