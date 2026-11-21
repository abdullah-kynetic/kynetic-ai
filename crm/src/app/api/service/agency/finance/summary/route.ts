import { errorResponse } from '@/server/errors';
import { getServiceFinanceSummary } from '@/server/service-api';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Revenue, expenses and net for one month (?month=YYYY-MM), default the current Pacific month.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const month = new URL(request.url).searchParams.get('month') ?? undefined;
      const data = await withServiceTenant(svc, (tx) => getServiceFinanceSummary(tx, svc, month));
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);
