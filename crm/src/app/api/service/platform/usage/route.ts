import { errorResponse } from '@/server/errors';
import { getServicePlatformUsage } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Query: month=YYYY-MM (default: the current month). Usage and cost per client.
export const GET = withPlatformAuth(
  async (request, plat) => {
    try {
      const month = new URL(request.url).searchParams.get('month') ?? undefined;
      const data = await getServicePlatformUsage(plat, month);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'usage:read' }
);
