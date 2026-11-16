import { moveDeal } from '@/server/deals';
import { errorResponse } from '@/server/errors';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { parseJsonBody } from '@/server/validation';
import { moveDealSchema } from '@/server/deals/schemas';
import { z } from 'zod';

const inputSchema = z.strictObject({ idempotencyKey: z.string().min(1).max(200), dealId: z.uuid(), ...moveDealSchema.shape });
export const POST = withServiceAuth(async (request, svc) => {
  try {
    const input = await parseJsonBody(request, inputSchema);
    const { idempotencyKey: _idempotencyKey, dealId, ...move } = input;
    const deal = await withServiceTenant(svc, (tx) => moveDeal({ tenantId: svc.tenantId, role: 'system' }, dealId, move, { tx }));
    return Response.json({ ok: true, data: deal });
  } catch (error) { return errorResponse(error); }
}, { requiredScope: 'update-deal-stage' });

