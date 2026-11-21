import { errorResponse } from '@/server/errors';
import {
  listServicePlatformClients,
  onboardServiceClient,
  readJsonBody
} from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Every client with health and plan. Owner's admin key only; no X-Kynetic-Client header.
export const GET = withPlatformAuth(
  async (_request, plat) => {
    try {
      const data = await listServicePlatformClients(plat);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

// Onboards a client workspace with defaults. Sends no invite. Body: businessName, ownerEmail, optional slug, phone.
export const POST = withPlatformAuth(
  async (request, plat) => {
    try {
      const { json } = await readJsonBody(request);
      const data = await onboardServiceClient(plat, json);
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
