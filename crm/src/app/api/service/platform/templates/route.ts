import { errorResponse } from '@/server/errors';
import {
  listServiceAccountTemplates,
  readJsonBody,
  saveServiceAccountTemplate
} from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

export const GET = withPlatformAuth(
  async (_request, plat) => {
    try {
      const data = await listServiceAccountTemplates(plat);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

// Body: { "sourceTenantId": "uuid", "name": "...", "description"?: "..." }. Saves a template from a client.
export const POST = withPlatformAuth(
  async (request, plat) => {
    try {
      const { json } = await readJsonBody(request);
      const data = await saveServiceAccountTemplate(plat, json);
      return Response.json(
        { ok: true, data },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
