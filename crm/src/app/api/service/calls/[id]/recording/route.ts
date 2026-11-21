import { createStorage } from '@/server/adapters/storage';
import { errorResponse } from '@/server/errors';
import { getEnv } from '@/server/env';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { getServiceRecordingLink } from '@/server/service-api';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// A five-minute signed link to one call's recording. The storage key is never returned. Each link is
// an audited read (`service.read`). Needs the calls:recording scope, which is separate from calls:read.
export const GET = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const storage = createStorage(getEnv());
      const data = await withServiceTenant(svc, async (tx) => {
        const link = await getServiceRecordingLink(tx, svc, id, storage);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'calls',
          entityId: id,
          after: { route: 'GET /api/service/calls/{id}/recording', link: 'issued' }
        });
        return link;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'calls:recording' }
);
