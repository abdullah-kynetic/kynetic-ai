import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { flagServiceCall, readJsonBody } from '@/server/service-api';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Flags one call for Kynetic review. Flagging again changes nothing. Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await flagServiceCall(tx, svc, id, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.call_flag',
          entity: 'calls',
          entityId: id,
          after: { route: 'POST /api/service/calls/{id}/flag', alreadyFlagged: data.alreadyFlagged }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'calls:write' }
);
