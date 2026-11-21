import { errorResponse } from '@/server/errors';
import { getServicePlatformBilling } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Every client's plan and live totals, with a grand total in cents.
export const GET = withPlatformAuth(
  async (_request, plat) => {
    try {
      const data = await getServicePlatformBilling(plat);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);
