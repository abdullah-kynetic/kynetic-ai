import { errorResponse } from '@/server/errors';
import { loadEnabledModules } from '@/server/modules';
import { tenants } from '@/server/db/schema';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// The client this token belongs to. A token never reads another client, so this is the only "clients"
// view the service API has; the MCP server combines several tokens itself.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const [t] = await tx
          .select({
            id: tenants.id,
            slug: tenants.slug,
            name: tenants.name,
            status: tenants.status,
            plan: tenants.plan,
            timezone: tenants.timezone,
            goLiveAt: tenants.goLiveAt,
            guaranteeTargetBookings: tenants.guaranteeTargetBookings,
            guaranteeStartDate: tenants.guaranteeStartDate
          })
          .from(tenants)
          .limit(1);
        const modules = await loadEnabledModules(
          { tenantId: svc.tenantId, role: 'system' },
          { tx }
        );
        return {
          ...t,
          modules: [...modules.keys].sort(),
          crmLevel: modules.crmLevel
        };
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'tenant:read' }
);
