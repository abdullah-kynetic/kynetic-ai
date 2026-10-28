import { NextResponse } from 'next/server';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth/authenticate';
import { errorResponse } from '@/server/errors';
import { parseSearchParams } from '@/server/validation';
import { availabilityInputSchema, listAvailableSlots } from '@/server/appointments';

export const dynamic = 'force-dynamic';

export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const input = parseSearchParams(
        new URL(request.url),
        availabilityInputSchema.extend({
          from: availabilityInputSchema.shape.from,
          to: availabilityInputSchema.shape.to
        })
      );
      const slots = await withServiceTenant(svc, (tx) =>
        listAvailableSlots({ tenantId: svc.tenantId, role: 'system' }, input, { tx } as never)
      );
      return NextResponse.json(
        { ok: true, slots: slots.map((slot) => slot.toISOString()) },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'appointments:read' }
);
