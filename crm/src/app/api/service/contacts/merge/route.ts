import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { mergeServiceContacts, readJsonBody, serviceMergeBodySchema } from '@/server/service-api';
import { parseInput } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Merges the loser into the survivor. Deals, tasks, notes, calls, messages and appointments move to the
// survivor; opt-outs and DNC carry over, consent grants stay with the contact who gave them. The loser
// is hidden, not deleted. Irreversible, so it needs contacts:delete. Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const { survivorId, loserId } = parseInput(serviceMergeBodySchema, json);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await mergeServiceContacts(tx, svc, survivorId, loserId);
        await auditService(tx, svc, {
          action: 'service.contact_merge',
          entity: 'contact',
          entityId: survivorId,
          after: { route: 'POST /api/service/contacts/merge', survivorId, loserId }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:delete' }
);
