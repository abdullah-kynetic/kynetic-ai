import { createTask } from '@/server/tasks';
import { createTaskSchema } from '@/server/tasks/schemas';
import { errorResponse } from '@/server/errors';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { parseJsonBody } from '@/server/validation';
import { z } from 'zod';

const inputSchema = z.strictObject({ idempotencyKey: z.string().min(1).max(200), ...createTaskSchema.shape });
export const POST = withServiceAuth(async (request, svc) => {
  try {
    const input = await parseJsonBody(request, inputSchema);
    const { idempotencyKey: _idempotencyKey, ...taskInput } = input;
    const task = await withServiceTenant(svc, (tx) => createTask({ tenantId: svc.tenantId, role: 'system' }, taskInput, { tx }));
    return Response.json({ ok: true, data: task });
  } catch (error) { return errorResponse(error); }
}, { requiredScope: 'create-task' });

