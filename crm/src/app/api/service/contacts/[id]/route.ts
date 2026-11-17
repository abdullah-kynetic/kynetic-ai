import { NextResponse } from 'next/server';
import { getContactDetail } from '@/server/contacts';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { errorResponse } from '@/server/errors';

export const dynamic = 'force-dynamic';

export const GET = withServiceAuth(
  async (_request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const detail = await withServiceTenant(svc, async (tx) => {
        const result = await getContactDetail({ tenantId: svc.tenantId, role: 'system' }, id, {
          tx
        });
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'contact',
          entityId: id,
          after: { route: 'GET /api/service/contacts/{id}' }
        });
        return result;
      });
      return NextResponse.json({ ok: true, contact: detail });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);
