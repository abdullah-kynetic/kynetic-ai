import { errorResponse } from '@/server/errors';
import { searchServiceContacts } from '@/server/service-api';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Contact search by name, phone or email: GET /api/service/search?q=...
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = new URL(request.url).searchParams.get('q');
      const data = await withServiceTenant(svc, async (tx) => {
        const result = await searchServiceContacts(tx, svc, q);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'contact',
          after: { route: 'GET /api/service/search' }
        });
        return result;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);
