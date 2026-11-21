import { errorResponse } from '@/server/errors';
import {
  getServiceOutboundPause,
  readJsonBody,
  setServiceOutboundPause
} from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Kill switch read. Body for PUT: { "paused": true, "reason"?: "..." }. Only pausing is allowed.
export const GET = withPlatformAuth(
  async (_request, plat) => {
    try {
      const data = await getServiceOutboundPause(plat);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

export const PUT = withPlatformAuth(
  async (request, plat) => {
    try {
      const { json } = await readJsonBody(request);
      const data = await setServiceOutboundPause(plat, json);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
