import { errorResponse, ValidationError } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';
import {
  companyListQuerySchema,
  createServiceCompany,
  getServiceCompanyDetail,
  listServiceCompanies,
  readJsonBody,
  updateServiceCompany,
  deleteServiceCompany
} from '@/server/service-api';
import { parseInput, parseSearchParams, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// One company with its live contacts (no phone or email) and deals.
export const GET = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const data = await withServiceTenant(svc, async (tx) => {
        const result = await getServiceCompanyDetail(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'company',
          entityId: id,
          after: { route: 'GET /api/service/companies/{id}' }
        });
        return result;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'companies:read' }
);

// Edits the fields sent. Requires an Idempotency-Key header.
export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new ValidationError({ '': ['invalid_body'] });
      }
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const { data, fields } = await updateServiceCompany(
          tx,
          svc,
          id,
          json as Record<string, unknown>
        );
        await auditService(tx, svc, {
          action: 'service.company_update',
          entity: 'company',
          entityId: id,
          after: { route: 'PATCH /api/service/companies/{id}', fields }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'companies:write' }
);

// Soft-deletes one company. Requires an Idempotency-Key header and no body.
export const DELETE = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const result = await runIdempotent(svc, request, '', async (tx) => {
        const data = await deleteServiceCompany(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.company_delete',
          entity: 'company',
          entityId: id,
          after: { route: 'DELETE /api/service/companies/{id}' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'companies:write' }
);
