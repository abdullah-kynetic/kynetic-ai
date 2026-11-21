import { errorResponse } from '@/server/errors';
import { readJsonBody, replyPlatformSupport } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

export const POST = withPlatformAuth(
  async (request, plat, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { json } = await readJsonBody(request);
      const data = await replyPlatformSupport(plat, id, json);
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
