import { errorResponse } from '@/server/errors';
import { replayServiceWebhook } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Replaying a webhook that already succeeded is a no-op in the portal.
export const POST = withPlatformAuth(
  async (_request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const data = await replayServiceWebhook(plat, id);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
