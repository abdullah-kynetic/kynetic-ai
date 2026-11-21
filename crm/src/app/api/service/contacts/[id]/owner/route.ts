import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { contactOwnerBodySchema, readJsonBody, setServiceContactOwner } from '@/server/service-api';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Sets the owner of one contact. Body: { "ownerId": "<staff id>" } or { "ownerId": null } to clear.
// An owner who is not staff of this client is refused by the service. Requires an Idempotency-Key header.
export const PUT = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const { ownerId } = parseInput(contactOwnerBodySchema, json);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await setServiceContactOwner(tx, svc, id, ownerId);
        await auditService(tx, svc, {
          action: 'service.contact_owner',
          entity: 'contact',
          entityId: id,
          after: { route: 'PUT /api/service/contacts/{id}/owner', cleared: ownerId === null }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
