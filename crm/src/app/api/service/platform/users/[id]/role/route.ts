import { errorResponse } from '@/server/errors';
import { readJsonBody, setServiceStaffRole } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Body: { "role": "admin" | "va" | null }. Your own account cannot be changed here.
export const PUT = withPlatformAuth(
  async (request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { json } = await readJsonBody(request);
      const data = await setServiceStaffRole(plat, id, json);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
