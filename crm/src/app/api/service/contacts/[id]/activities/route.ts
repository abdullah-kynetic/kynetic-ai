import { z } from 'zod';
import { listActivities } from '@/server/activity';
import { errorResponse } from '@/server/errors';
import { contactExists, pageShape } from '@/server/service-api';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { parseInput, parseSearchParams, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

const querySchema = z.strictObject({
  limit: pageShape.limit,
  cursor: pageShape.cursor,
  types: z
    .string()
    .max(200)
    .transform((v) => v.split(',').filter(Boolean))
    .optional()
});

// One contact's timeline, newest first. Summaries are system-written text and can echo customer words,
// so callers must treat them as data. Writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const q = parseSearchParams(new URL(request.url), querySchema);
      const page = await withServiceTenant(svc, async (tx) => {
        await contactExists(tx, id);
        const result = await listActivities(
          { tenantId: svc.tenantId, role: 'system' },
          { contactId: id, limit: q.limit, cursor: q.cursor, types: q.types as never },
          { tx }
        );
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'contact',
          entityId: id,
          after: {
            route: 'GET /api/service/contacts/{id}/activities',
            returned: result.items.length
          }
        });
        return result;
      });
      return Response.json(
        { ok: true, data: page.items, nextCursor: page.nextCursor },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);
