import { NextResponse } from 'next/server';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth/authenticate';
import { errorResponse } from '@/server/errors';
import { parseJsonBody } from '@/server/validation';
import { bookAppointment } from '@/server/appointments';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const bodySchema = z
  .object({
    contactId: z.uuid().nullish(),
    dealId: z.uuid().nullish(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    address: z.record(z.string(), z.unknown()).default({}),
    notes: z.string().trim().max(20000).nullish(),
    externalEventId: z.string().trim().min(1).max(200).nullish()
  })
  .strict();

export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const input = await parseJsonBody(request, bodySchema);
      const appointment = await withServiceTenant(svc, (tx) =>
        bookAppointment({ tenantId: svc.tenantId, role: 'system' }, input, { tx })
      );
      return NextResponse.json({ ok: true, appointment }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'appointments:write' }
);
