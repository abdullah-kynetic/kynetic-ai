import { errorResponse } from '@/server/errors';
import {
  createServiceCustomField,
  listServiceCustomFields,
  parseEntityFilter,
  readJsonBody
} from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Field definitions, optionally one entity: ?entity=contact|company|deal. Each read is audited.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const entity = parseEntityFilter(new URL(request.url).searchParams.get('entity'));
      const data = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceCustomFields(tx, svc, entity);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'custom_field',
          after: { route: 'GET /api/service/settings/custom-fields' }
        });
        return rows;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

// Body: entity, key, label, type, options, showInTable, filterable, importable. Idempotency-Key required.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceCustomField(tx, svc, json as never);
        await auditService(tx, svc, {
          action: 'service.custom_field_create',
          entity: 'custom_field',
          entityId: data.id,
          after: { route: 'POST /api/service/settings/custom-fields' }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
