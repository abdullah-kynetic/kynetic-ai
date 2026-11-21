import { errorResponse } from '@/server/errors';
import { exportServiceFinanceCsv } from '@/server/service-api';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// CSV of one tab: ?tab=revenue|expenses|referrals|case-studies. Admin key only.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const tab = new URL(request.url).searchParams.get('tab');
      const csv = await withServiceTenant(svc, (tx) => exportServiceFinanceCsv(tx, svc, tab));
      return new Response(csv, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);
