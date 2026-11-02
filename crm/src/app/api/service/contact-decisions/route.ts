import { contactDecisionSchema, recordContactDecision } from '@/server/contact-decisions';
import { errorResponse } from '@/server/errors';
import { withServiceAuth } from '@/server/service-auth';
import { parseJsonBody } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const input = await parseJsonBody(request, contactDecisionSchema, 8_000);
      const result = await recordContactDecision(svc, input);
      return Response.json(
        { ok: true, data: result },
        {
          status: result.status === 'recorded' ? 201 : 200,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contact-decisions:write' }
);
