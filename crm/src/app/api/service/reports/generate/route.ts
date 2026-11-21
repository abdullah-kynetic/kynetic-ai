import { errorResponse } from '@/server/errors';
import { generateServiceReport, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Generates (or regenerates) one month's report. Body: { "periodStart": "YYYY-MM-01" }.
// Requires an Idempotency-Key header. One report per month: the same month updates its row.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const periodStart = (json as { periodStart?: unknown }).periodStart;
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const { report } = await generateServiceReport(tx, svc, periodStart);
        await auditService(tx, svc, {
          action: 'service.report_generate',
          entity: 'report',
          entityId: report.id,
          after: { route: 'POST /api/service/reports/generate', periodStart }
        });
        return { status: 200, body: { ok: true, data: { id: report.id, periodStart } } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'reports:write' }
);
