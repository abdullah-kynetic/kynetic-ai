import { errorResponse } from '@/server/errors';
import { getServiceProspectFunnel } from '@/server/service-api';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Prospect counts by stage, admin key only.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const funnel = await getServiceProspectFunnel(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'agency_prospect',
          after: { route: 'GET /api/service/agency/prospects/funnel' }
        });
        return funnel;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);
