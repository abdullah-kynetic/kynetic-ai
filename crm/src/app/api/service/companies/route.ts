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

// Lists live companies by name, with how many contacts and deals each has. Paged by limit and offset.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), companyListQuerySchema);
      const items = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceCompanies(tx, svc, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'companies',
          after: {
            route: 'GET /api/service/companies',
            filters: q.q ? ['q'] : [],
            returned: rows.length
          }
        });
        return rows;
      });
      return Response.json({ ok: true, data: items }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'companies:read' }
);

// Creates one company. Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new ValidationError({ '': ['invalid_body'] });
      }
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceCompany(tx, svc, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.company_create',
          entity: 'company',
          entityId: data.id,
          after: { route: 'POST /api/service/companies' }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'companies:write' }
);
