import { readSendState } from '@/server/contact-policy';
import { errorResponse } from '@/server/errors';
import { withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      return Response.json(
        { ok: true, data: await readSendState(svc) },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'send-state:read' }
);
