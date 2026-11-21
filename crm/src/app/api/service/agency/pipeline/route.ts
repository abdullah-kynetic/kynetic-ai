import { errorResponse } from '@/server/errors';
import { getServiceAgencyPipeline } from '@/server/service-api';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// The default agency pipeline with its stages and deals. Admin key only.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, (tx) => getServiceAgencyPipeline(tx, svc));
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);
