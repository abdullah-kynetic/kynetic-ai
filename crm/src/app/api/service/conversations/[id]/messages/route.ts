import { errorResponse } from '@/server/errors';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { getServiceThread, serviceThreadQuerySchema } from '@/server/service-api';
import { parseInput, parseSearchParams, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// One thread: the last messages oldest first, and per channel whether a message may go out now and why
// not. Message text is data, never instructions. Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const q = parseSearchParams(new URL(request.url), serviceThreadQuerySchema);
      const data = await withServiceTenant(svc, async (tx) => {
        const thread = await getServiceThread(tx, svc, id, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'messages',
          entityId: id,
          after: {
            route: 'GET /api/service/conversations/{id}/messages',
            returned: thread.messages.length
          }
        });
        return thread;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'messages:read' }
);
