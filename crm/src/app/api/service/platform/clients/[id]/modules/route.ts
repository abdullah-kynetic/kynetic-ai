import { errorResponse } from '@/server/errors';
import {
  getServiceClientModules,
  readJsonBody,
  setServiceClientModule
} from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

export const GET = withPlatformAuth(
  async (_request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const data = await getServiceClientModules(plat, id);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

// Body: { "templateKey": "...", "enabled": true | false }. One automation template at a time.
export const PUT = withPlatformAuth(
  async (request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { json } = await readJsonBody(request);
      const data = await setServiceClientModule(plat, id, json);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
