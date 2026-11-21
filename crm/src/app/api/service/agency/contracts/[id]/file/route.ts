import { errorResponse } from '@/server/errors';
import { getServiceContractFile } from '@/server/service-api';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// A short-lived link to the signed contract file (5 minutes). Admin key only.
export const GET = withServiceAuth(
  async (_request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const data = await withServiceTenant(svc, (tx) => getServiceContractFile(tx, svc, id));
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'deals:read' }
);
