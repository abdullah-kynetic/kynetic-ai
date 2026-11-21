import { errorResponse } from '@/server/errors';
import { assignServiceAgencyCampaign, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Body: { "contactId": "uuid" }. Adds an agency contact to the campaign. Nothing is sent. Idempotency-Key required.
export const POST = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        await assignServiceAgencyCampaign(tx, svc, id, json);
        return { status: 200, body: { ok: true, data: { assigned: true } } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
