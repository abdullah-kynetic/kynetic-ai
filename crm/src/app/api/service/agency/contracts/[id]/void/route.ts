import { errorResponse } from '@/server/errors';
import { voidServiceContract } from '@/server/service-api';
import { idempotentResponse, runIdempotent, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Voids a contract. A signed contract cannot be voided (CONFLICT). Idempotency-Key required, no body.
export const POST = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const result = await runIdempotent(svc, request, '', async (tx) => {
        const data = await voidServiceContract(tx, svc, id);
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
