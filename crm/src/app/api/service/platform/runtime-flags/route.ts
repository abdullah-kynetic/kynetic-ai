import { errorResponse } from '@/server/errors';
import { getServiceRuntimeFlags } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Read-only. PROVIDER_MODE and OUTBOUND_ENABLED from the deploy. Nothing here can change them.
export const GET = withPlatformAuth(
  async (_request, plat) => {
    try {
      const data = getServiceRuntimeFlags(plat);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);
