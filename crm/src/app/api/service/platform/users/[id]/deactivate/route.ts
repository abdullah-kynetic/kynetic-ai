import { errorResponse } from '@/server/errors';
import { deactivateServiceUser } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

export const POST = withPlatformAuth(
  async (_request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const data = await deactivateServiceUser(plat, id);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
