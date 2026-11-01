import { callResultSchema, recordCallResult } from '@/server/call-results';
import { errorResponse } from '@/server/errors';
import { moduleDisabledResponse, ModuleDisabledError } from '@/server/modules';
import { withServiceAuth } from '@/server/service-auth';
import { parseJsonBody } from '@/server/validation';

export const dynamic = 'force-dynamic';
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const input = await parseJsonBody(request, callResultSchema, 250_000);
      const result = await recordCallResult(svc, input);
      return Response.json(
        { ok: true, data: result },
        {
          status: result.status === 'recorded' ? 201 : 200,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'calls:write' }
);
