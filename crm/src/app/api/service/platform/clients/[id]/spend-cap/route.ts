import { errorResponse } from '@/server/errors';
import { setServiceSpendCap, readJsonBody } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Body: { "cents": number } to lower the cap, or refused. Raising or removing a cap is not available here.
export const PUT = withPlatformAuth(
  async (request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { json } = await readJsonBody(request);
      const data = await setServiceSpendCap(plat, id, json);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
