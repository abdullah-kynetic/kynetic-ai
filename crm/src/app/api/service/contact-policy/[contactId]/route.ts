import { readContactPolicy } from '@/server/contact-policy';
import { errorResponse } from '@/server/errors';
import { withServiceAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';
export const GET = withServiceAuth(
  async (_request, svc, context: { params: Promise<{ contactId: string }> }) => {
    try {
      const { contactId } = await context.params;
      return Response.json(
        { ok: true, data: await readContactPolicy(svc, contactId) },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contact-policy:read' }
);
