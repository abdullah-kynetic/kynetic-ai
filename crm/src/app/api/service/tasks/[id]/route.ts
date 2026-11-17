import { errorResponse, ValidationError } from '@/server/errors';
import { moduleDisabledResponse, ModuleDisabledError } from '@/server/modules';
import { serviceTaskUpdateSchema, updateServiceTask } from '@/server/service-api';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Edits fields of one task (title, dueAt, assigneeId, contactId, dealId, priority). It cannot complete,
// reopen or delete a task. A task of another tenant is a 404 with nothing written. The audit row names
// the changed fields, not their values. Requires an Idempotency-Key header.
export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const raw = await request.text();
      if (raw.length > 10_000) throw new ValidationError({ '': ['too_big'] });
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new ValidationError({ '': ['invalid_json'] });
      }
      const input = parseInput(serviceTaskUpdateSchema, json);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const { data, fields } = await updateServiceTask(tx, svc, id, input);
        await auditService(tx, svc, {
          action: 'service.task_update',
          entity: 'task',
          entityId: id,
          after: { route: 'PATCH /api/service/tasks/{id}', fields }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'tasks:write' }
);
