import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { exportServiceContacts, serviceExportQuerySchema } from '@/server/service-api';
import { parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

// CSV of every live contact matching the optional q and status. Names, phone, email, status, source,
// tags and owner. Spreadsheet formulas are neutralized. The audit row holds the row count and whether a
// filter was used, never the values. Needs contacts:export.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), serviceExportQuerySchema);
      const csv = await exportServiceContacts(svc, q);
      const rows = Math.max(0, csv.split('\n').length - 1);
      await withServiceTenant(svc, async (tx) => {
        await auditService(tx, svc, {
          action: 'service.contact_export',
          entity: 'contacts',
          after: {
            route: 'GET /api/service/contacts/export',
            rows,
            filtered: Boolean(q.q || q.status)
          }
        });
      });
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="contacts.csv"',
          'Cache-Control': 'no-store'
        }
      });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:export' }
);
