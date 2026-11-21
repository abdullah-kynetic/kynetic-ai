import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';
import { createServiceStage, listServiceStages, readJsonBody } from '@/server/service-api';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// The stages of one pipeline, with deal counts. Read only.
export const GET = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const data = await withServiceTenant(svc, async (tx) => {
        const stages = await listServiceStages(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'pipeline',
          entityId: id,
          after: { route: 'GET /api/service/pipelines/{id}/stages' }
        });
        return stages;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);

// Adds one stage. The 20-stage cap applies. Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceStage(tx, svc, id, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.stage_create',
          entity: 'pipeline',
          entityId: id,
          after: { route: 'POST /api/service/pipelines/{id}/stages' }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'pipeline:write' }
);
