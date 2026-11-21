import { errorResponse } from '@/server/errors';
import { getServiceClientBilling } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

export const GET = withPlatformAuth(
  async (_request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const data = await getServiceClientBilling(plat, id);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);
