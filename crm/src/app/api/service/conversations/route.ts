import { errorResponse } from '@/server/errors';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { listServiceConversations, serviceConversationsQuerySchema } from '@/server/service-api';
import { parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Conversations, newest first. Names and times only. Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), serviceConversationsQuerySchema);
      const items = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceConversations(tx, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'messages',
          after: { route: 'GET /api/service/conversations', returned: rows.length }
        });
        return rows;
      });
      return Response.json({ ok: true, data: items }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'messages:read' }
);
