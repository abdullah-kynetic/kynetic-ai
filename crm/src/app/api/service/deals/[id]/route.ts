import { errorResponse } from '@/server/errors';
import {
  deleteServiceDeal,
  getDealDto,
  readJsonBody,
  updateServiceDeal
} from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const GET = withServiceAuth(
  async (_request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const data = await withServiceTenant(svc, async (tx) => {
        const deal = await getDealDto(tx, id);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'deal',
          entityId: id,
          after: { route: 'GET /api/service/deals/{id}' }
        });
        return deal;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);

// Edits the fields sent. Requires an Idempotency-Key header.

export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await updateServiceDeal(tx, svc, id, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.deal_update',
          entity: 'deal',
          entityId: id,
          after: { route: 'PATCH /api/service/deals/{id}' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);

// Soft delete. Requires an Idempotency-Key header and no body.
export const DELETE = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const result = await runIdempotent(svc, request, '', async (tx) => {
        const data = await deleteServiceDeal(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.deal_delete',
          entity: 'deal',
          entityId: id,
          after: { route: 'DELETE /api/service/deals/{id}' }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:write' }
);
