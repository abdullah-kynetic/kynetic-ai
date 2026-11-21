import { errorResponse } from '@/server/errors';
import { getServiceAgencyBilling } from '@/server/service-api';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Deal terms and invoice drafts. Nothing is charged or sent from here. Admin key only.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, (tx) => getServiceAgencyBilling(tx, svc));
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);
