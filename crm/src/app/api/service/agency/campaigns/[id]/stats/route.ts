import { errorResponse } from '@/server/errors';
import { getServiceCampaignStats } from '@/server/service-api';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Stats for one campaign. Each read is audited.
export const GET = withServiceAuth(
  async (_request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const data = await withServiceTenant(svc, async (tx) => {
        const stats = await getServiceCampaignStats(tx, svc, id);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'agency_campaign',
          entityId: id,
          after: { route: 'GET /api/service/agency/campaigns/{id}/stats' }
        });
        return stats;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);
