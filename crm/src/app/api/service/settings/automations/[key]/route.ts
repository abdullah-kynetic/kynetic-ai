import { errorResponse } from '@/server/errors';
import { readJsonBody, setServiceAutomation } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Body: { "enabled": true | false }. Turning off cancels that template's pending runs. Idempotency-Key required.
export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ key: string }> }) => {
    try {
      const { key } = await context.params;
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await setServiceAutomation(tx, svc, key, json);
        await auditService(tx, svc, {
          action: 'service.automation_toggle',
          entity: 'automation',
          entityId: data.id,
          after: { route: 'PATCH /api/service/settings/automations/{key}', enabled: data.enabled }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'automation:write' }
);
