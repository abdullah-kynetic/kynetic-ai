import { AppError, errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { bulkServiceContacts, readJsonBody, serviceBulkBodySchema } from '@/server/service-api';
import { parseInput } from '@/server/validation';

export const dynamic = 'force-dynamic';

// One action on up to 200 contacts: tag add and remove, owner, status, or delete. Enroll is not offered.
// Delete also needs contacts:delete. Any id that is not a live contact of this client fails the whole call.
// Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const input = parseInput(serviceBulkBodySchema, json);
      if (input.action.type === 'delete' && !svc.scopes.includes('contacts:delete')) {
        throw new AppError('FORBIDDEN');
      }
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await bulkServiceContacts(tx, svc, input);
        await auditService(tx, svc, {
          action: 'service.contact_bulk',
          entity: 'contact',
          after: {
            route: 'POST /api/service/contacts/bulk',
            type: data.type,
            requested: data.requested
          }
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
