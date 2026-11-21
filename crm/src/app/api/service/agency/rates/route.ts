import { errorResponse } from '@/server/errors';
import { getServiceAgencyRates } from '@/server/service-api';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Query: days (1 to 30, default 7).
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const days = new URL(request.url).searchParams.get('days') ?? undefined;
      const data = await withServiceTenant(svc, (tx) => getServiceAgencyRates(tx, svc, days));
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'metrics:read' }
);
