import { errorResponse } from '@/server/errors';
import { createServiceInvoiceDraft, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Creates an invoice DRAFT for one cycle of a deal's terms. Nothing is charged, reminded or emailed.
// Body: dealId, kind (setup|monthly), installment?, period?, dueOn. Idempotency-Key required.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceInvoiceDraft(tx, svc, json);
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
