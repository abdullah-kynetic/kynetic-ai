import { errorResponse } from '@/server/errors';
import { searchServiceAudit } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Query: tenant, actor, action, from, to, page. Key hashes and admin key rows are never returned.
export const GET = withPlatformAuth(
  async (request, plat) => {
    try {
      const query = Object.fromEntries(new URL(request.url).searchParams.entries());
      const data = await searchServiceAudit(plat, query);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);
