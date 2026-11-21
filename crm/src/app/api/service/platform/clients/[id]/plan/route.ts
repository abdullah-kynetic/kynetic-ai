import { errorResponse } from '@/server/errors';
import { readJsonBody, setServiceClientPlan } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Body: { "plan"?: "founding" | "value", "pricingTier"?: "T1" | "T2" | "T3" | null }. Audited by the portal.
export const PUT = withPlatformAuth(
  async (request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { json } = await readJsonBody(request);
      const data = await setServiceClientPlan(plat, id, json);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
