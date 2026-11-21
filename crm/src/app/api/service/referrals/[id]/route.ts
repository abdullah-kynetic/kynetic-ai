import { errorResponse } from '@/server/errors';
import { readJsonBody, updateServiceReferral } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth } from '@/server/service-auth';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Edits the fields sent. Reward fields are refused. Requires an Idempotency-Key header.
export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await updateServiceReferral(tx, svc, id, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.referral_update',
          entity: 'client_referral',
          entityId: id,
          after: { route: 'PATCH /api/service/referrals/{id}' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'referrals:write' }
);
