import { errorResponse } from '@/server/errors';
import { getServiceTeam } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Team members and pending invites. Inviting and removing are held (Tier B) and not exposed.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const team = await getServiceTeam(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'team',
          after: { route: 'GET /api/service/settings/team' }
        });
        return team;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);
