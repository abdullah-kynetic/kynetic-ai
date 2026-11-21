import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  appointmentInput,
  assertInsideBusinessHours,
  bookAppointment,
  cancelAppointment,
  isoDate,
  listAvailableSlots,
  updateAppointment
} from '../appointments/service';
import type { Tx } from '../db/client';
import { appointments } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';

// Appointments for the service API (C6): detail, availability, book, reschedule and cancel. Every write
// is tagged origin 'service-api' and sends no calendar invite and no text: confirmations stay off until
// the owner gives rules. A slot clash is a 409 and a time outside business hours is a 400.

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });
const origin = { origin: 'service-api' as const };

export const serviceAvailabilityQuerySchema = z.strictObject({
  from: isoDate,
  to: isoDate,
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  bufferMinutes: z.coerce.number().int().min(0).max(240).default(0),
  slotMinutes: z.coerce.number().int().min(1).max(1440).optional()
});
export type ServiceAvailabilityQuery = z.output<typeof serviceAvailabilityQuerySchema>;

// Reschedule accepts times and notes only. Status changes go through cancel.
export const serviceRescheduleSchema = z
  .object({
    startsAt: isoDate.optional(),
    endsAt: isoDate.optional(),
    notes: z.string().trim().max(20000).nullable().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'empty' });

async function appointmentDto(tx: Tx, id: string) {
  const [r] = await tx
    .select({
      id: appointments.id,
      contactId: appointments.contactId,
      dealId: appointments.dealId,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      notes: appointments.notes,
      bookedBy: appointments.bookedBy,
      updatedAt: appointments.updatedAt
    })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  if (!r) throw new AppError('NOT_FOUND');
  return r;
}

/** Runs inside withServiceTenant. Tenant isolation is row-level: another tenant's id is a 404. */
export async function getServiceAppointment(tx: Tx, id: string) {
  parseInput(uuidSchema, id);
  return appointmentDto(tx, id);
}

/** Runs inside withServiceTenant. Free slots for the window, in business hours, not overlapping bookings. */
export async function getServiceAvailability(
  tx: Tx,
  svc: ServiceContext,
  q: ServiceAvailabilityQuery
) {
  const slots = await listAvailableSlots(sysCtx(svc), q, { tx });
  return { slots: slots.map((at) => at.toISOString()) };
}

/** Runs inside withServiceTenant. */
export async function bookServiceAppointment(
  tx: Tx,
  svc: ServiceContext,
  body: Record<string, unknown>
) {
  const input = parseInput(appointmentInput, body);
  const row = await bookAppointment(sysCtx(svc), input, { tx, bookedBy: 'user', ...origin });
  return appointmentDto(tx, row.id);
}

/** Runs inside withServiceTenant. Checks business hours for any new time, then the calendar clash rule. */
export async function rescheduleServiceAppointment(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: Record<string, unknown>
) {
  const patch = parseInput(serviceRescheduleSchema, body);
  const current = await appointmentDto(tx, id);
  if (current.status === 'cancelled') throw new ValidationError({ status: ['cancelled'] });
  if (patch.startsAt || patch.endsAt) {
    const startsAt = patch.startsAt ?? new Date(current.startsAt);
    const endsAt = patch.endsAt ?? new Date(current.endsAt);
    if (endsAt <= startsAt) throw new ValidationError({ endsAt: ['after_starts_at'] });
    await assertInsideBusinessHours(tx, startsAt, endsAt);
  }
  await updateAppointment(sysCtx(svc), id, patch, { tx, ...origin });
  return appointmentDto(tx, id);
}

/** Runs inside withServiceTenant. Cancelling a cancelled appointment changes nothing and writes nothing. */
export async function cancelServiceAppointment(tx: Tx, svc: ServiceContext, id: string) {
  const current = await appointmentDto(tx, id);
  if (current.status !== 'cancelled') {
    await cancelAppointment(sysCtx(svc), id, { tx, ...origin });
  }
  return appointmentDto(tx, id);
}
