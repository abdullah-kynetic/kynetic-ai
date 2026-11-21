import { errorResponse } from '@/server/errors';
import { listServiceAgencyInbox } from '@/server/service-api';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Inbox. Query: channel (sms|email|dm), status, contactId. Each read is audited.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const query = Object.fromEntries(new URL(request.url).searchParams.entries());
      const data = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceAgencyInbox(tx, svc, query);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'agency_inbox',
          after: { route: 'GET /api/service/agency/inbox', returned: rows.length }
        });
        return rows;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'messages:read' }
);
