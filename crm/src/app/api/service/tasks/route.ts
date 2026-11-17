import { errorResponse, ValidationError } from '@/server/errors';
import { moduleDisabledResponse, ModuleDisabledError } from '@/server/modules';
import {
  createServiceTask,
  listTasksDto,
  serviceTaskCreateSchema,
  taskListSchema,
  usedFilters
} from '@/server/service-api';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';
import { parseInput, parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Read only. Each call writes a `service.read` audit row (token id, route, filter names, count).
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), taskListSchema);
      const page = await withServiceTenant(svc, async (tx) => {
        const result = await listTasksDto(tx, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'tasks',
          after: {
            route: 'GET /api/service/tasks',
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
  { requiredScope: 'tasks:read' }
);

// Creates one task. The title is untrusted text, reduced to plain text. A task made here is a system
// action and queues no due reminder, so nothing is notified or emailed. Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const raw = await request.text();
      if (raw.length > 10_000) throw new ValidationError({ '': ['too_big'] });
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new ValidationError({ '': ['invalid_json'] });
      }
      const input = parseInput(serviceTaskCreateSchema, json);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceTask(tx, svc, input);
        await auditService(tx, svc, {
          action: 'service.task_create',
          entity: 'task',
          entityId: data.id,
          after: {
            route: 'POST /api/service/tasks',
            contactId: data.contactId,
            dealId: data.dealId,
            assigneeId: data.assigneeId,
            priority: data.priority,
            dueAt: data.dueAt
          }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'tasks:write' }
);
