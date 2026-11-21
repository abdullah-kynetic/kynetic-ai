import { errorResponse } from '@/server/errors';
import { deleteServiceExpense, editServiceExpense, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Edits write an audit row with the before and after values. Idempotency-Key required.
export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await editServiceExpense(tx, svc, id, json);
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);

// Soft delete. Idempotency-Key required, no body.
export const DELETE = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const result = await runIdempotent(svc, request, '', async (tx) => {
        const data = await deleteServiceExpense(tx, svc, id);
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
