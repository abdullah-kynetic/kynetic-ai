import { errorResponse } from '@/server/errors';
import { listServiceFailedWebhooks } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

export const GET = withPlatformAuth(
  async (_request, plat) => {
    try {
      const data = await listServiceFailedWebhooks(plat);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);
