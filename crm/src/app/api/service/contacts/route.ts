import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';
import {
  contactListSchema,
  createServiceContact,
  listContactsDto,
  readJsonBody,
  splitContactBody,
  usedFilters
} from '@/server/service-api';
import { parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Newest-updated first, keyset paged. Names and tags only: no phone or email in a list. Personal data
// is returned, so each call writes a `service.read` audit row (filter names and count, never values).
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), contactListSchema);
      const page = await withServiceTenant(svc, async (tx) => {
        const result = await listContactsDto(tx, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'contacts',
          after: {
            route: 'GET /api/service/contacts',
            filters: usedFilters(q),
            returned: result.items.length
          }
        });
        return result;
      });
      return Response.json(
        { ok: true, data: page.items, nextCursor: page.nextCursor },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);

// Creates one contact. A duplicate phone or email is a 409 that names the matching contact, unless the
// body sets acknowledgeDuplicates. Free text is plain text. Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const { body, acknowledgeDuplicates } = splitContactBody(json);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceContact(tx, svc, body, acknowledgeDuplicates);
        await auditService(tx, svc, {
          action: 'service.contact_create',
          entity: 'contact',
          entityId: data.id,
          after: { route: 'POST /api/service/contacts', status: data.status, source: data.source }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
