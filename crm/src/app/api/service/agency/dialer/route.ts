import { errorResponse } from '@/server/errors';
import { getServiceAgencyDialer } from '@/server/service-api';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Dialer queue. Optional ?campaignId=uuid narrows it to a campaign's contacts. Each read is audited.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const campaignId = new URL(request.url).searchParams.get('campaignId') ?? undefined;
      const data = await withServiceTenant(svc, async (tx) => {
        const result = await getServiceAgencyDialer(tx, svc, campaignId);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'agency_dialer',
          after: { route: 'GET /api/service/agency/dialer' }
        });
        return result;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);
