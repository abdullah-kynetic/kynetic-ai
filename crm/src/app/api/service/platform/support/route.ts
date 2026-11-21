import { errorResponse } from '@/server/errors';
import { listPlatformSupport } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Query: category, status. The staff support queue across clients.
export const GET = withPlatformAuth(
  async (request, plat) => {
    try {
      const query = Object.fromEntries(new URL(request.url).searchParams.entries());
      const data = await listPlatformSupport(plat, query);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);
