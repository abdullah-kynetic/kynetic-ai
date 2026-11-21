import { errorResponse } from '@/server/errors';
import { readJsonBody, setServiceClientLifecycle } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Body: { "stage": "onboarding" | "live" | "at_risk" | "churned" | "demo" }.
export const POST = withPlatformAuth(
  async (request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { json } = await readJsonBody(request);
      const data = await setServiceClientLifecycle(plat, id, json);
      return Response.json(
        { ok: true, data: { stage: data } },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
