import { and, eq, gt, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client';
import { appointments, contacts, deals, tenants } from '../db/schema';
import { audit } from '../audit';
import { recordActivity } from '../activity';
import { emitEvent } from '../events';
import { AppError, ValidationError } from '../errors';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { businessHoursSchema, type BusinessHours } from '../settings/hours';
import { availableSlots } from './availability';
import { z } from 'zod';

const isoDate = z.coerce.date();
const appointmentInput = z
  .object({
    contactId: uuidSchema.nullish(),
    dealId: uuidSchema.nullish(),
    startsAt: isoDate,
    endsAt: isoDate,
    address: z.record(z.string(), z.unknown()).default({}),
    notes: z.string().trim().max(20000).nullish(),
    externalEventId: z.string().trim().min(1).max(200).nullish()
  })
  .strict();
export const availabilityInputSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    durationMinutes: z.number().int().min(1).max(1440),
    bufferMinutes: z.number().int().min(0).max(240).default(0),
    slotMinutes: z.number().int().min(1).max(1440).optional()
  })
  .strict();
export type BookAppointmentInput = z.input<typeof appointmentInput>;
export type AvailabilityInput = z.input<typeof availabilityInputSchema>;
export type Appointment = typeof appointments.$inferSelect;
export const appointmentStatusSchema = z.enum(['scheduled', 'completed', 'no_show', 'cancelled']);

function run<T>(ctx: TenantContextInput, opts: { db?: Db; tx?: Tx }, fn: (tx: Tx) => Promise<T>) {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}

async function tenantSettings(tx: Tx) {
  const [row] = await tx
    .select({ timezone: tenants.timezone, businessHours: tenants.businessHours })
    .from(tenants)
    .where(eq(tenants.id, sql`app_tenant_id()`))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  return { timezone: row.timezone, businessHours: businessHoursSchema.parse(row.businessHours) };
}

async function assertLinks(tx: Tx, contactId?: string | null, dealId?: string | null) {
  if (contactId) {
    const [row] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
      .limit(1);
    if (!row) throw new ValidationError({ contactId: ['not_found'] });
  }
  if (dealId) {
    const [row] = await tx
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.id, dealId), isNull(deals.deletedAt)))
      .limit(1);
    if (!row) throw new ValidationError({ dealId: ['not_found'] });
  }
}

export async function listAvailableSlots(
  ctx: TenantContextInput,
  input: AvailabilityInput,
  opts: { db?: Db; tx?: Tx } = {}
) {
  const v = parseInput(availabilityInputSchema, input);
  return run(ctx, opts, async (tx) => {
    const settings = await tenantSettings(tx);
    const existing = await tx
      .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          lt(appointments.startsAt, v.to.toISOString()),
          gt(appointments.endsAt, v.from.toISOString()),
          ne(appointments.status, 'cancelled')
        )
      );
    return availableSlots({
      ...v,
      hours: settings.businessHours,
      timezone: settings.timezone,
      existing: existing.map((a) => ({
        startsAt: new Date(a.startsAt),
        endsAt: new Date(a.endsAt)
      }))
    });
  });
}

export async function bookAppointment(
  ctx: TenantContextInput,
  input: BookAppointmentInput,
  opts: { db?: Db; tx?: Tx; bookedBy?: 'alex' | 'user' | 'automation' | 'client_portal' } = {}
): Promise<Appointment> {
  const v = parseInput(appointmentInput, input);
  if (v.endsAt <= v.startsAt) throw new ValidationError({ endsAt: ['after_starts_at'] });
  return run(ctx, opts, async (tx) => {
    // Serializing on the tenant row makes the overlap check atomic across concurrent voice calls.
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`))
      .for('update');
    if (v.externalEventId) {
      const [existing] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.externalEventId, v.externalEventId))
        .limit(1);
      if (existing) return existing;
    }
    const settings = await tenantSettings(tx);
    const inside = availableSlots({
      hours: settings.businessHours,
      timezone: settings.timezone,
      from: v.startsAt,
      to: v.endsAt,
      durationMinutes: (v.endsAt.getTime() - v.startsAt.getTime()) / 60000,
      slotMinutes: 1
    });
    if (!inside.some((at) => at.getTime() === v.startsAt.getTime()))
      throw new ValidationError({ startsAt: ['outside_business_hours'] });
    await assertLinks(tx, v.contactId, v.dealId);
    const [collision] = await tx
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          ne(appointments.status, 'cancelled'),
          lt(appointments.startsAt, v.endsAt.toISOString()),
          gt(appointments.endsAt, v.startsAt.toISOString())
        )
      )
      .limit(1);
    if (collision) throw new AppError('CONFLICT');
    const [row] = await tx
      .insert(appointments)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        contactId: v.contactId ?? null,
        dealId: v.dealId ?? null,
        startsAt: v.startsAt.toISOString(),
        endsAt: v.endsAt.toISOString(),
        address: v.address,
        notes: v.notes ?? null,
        externalEventId: v.externalEventId ?? null,
        bookedBy: opts.bookedBy ?? 'alex',
        createdBy: ctx.userId ?? null
      })
      .returning();
    await recordActivity(tx, {
      contactId: row.contactId,
      dealId: row.dealId,
      type: 'appointment',
      refTable: 'appointments',
      refId: row.id,
      summary: 'Appointment booked',
      actor: { type: 'alex' }
    });
    await audit(tx, {
      action: 'appointment.create',
      entity: 'appointment',
      entityId: row.id,
      after: { startsAt: row.startsAt, endsAt: row.endsAt, bookedBy: row.bookedBy }
    });
    await emitEvent(tx, {
      name: 'appointment.booked',
      tenantId: ctx.tenantId,
      actor: { type: (opts.bookedBy === 'user' ? 'user' : 'alex') as 'alex' | 'user' },
      payload: { appointmentId: row.id, contactId: row.contactId, dealId: row.dealId }
    });
    return row;
  });
}

export async function updateAppointment(
  ctx: TenantContextInput,
  id: string,
  patch: {
    startsAt?: Date;
    endsAt?: Date;
    status?: z.input<typeof appointmentStatusSchema>;
    notes?: string | null;
  },
  opts: { db?: Db; tx?: Tx } = {}
): Promise<Appointment> {
  parseInput(uuidSchema, id);
  const v = parseInput(
    z
      .object({
        startsAt: isoDate.optional(),
        endsAt: isoDate.optional(),
        status: appointmentStatusSchema.optional(),
        notes: z.string().trim().max(20000).nullable().optional()
      })
      .strict(),
    patch
  );
  return run(ctx, opts, async (tx) => {
    const [before] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .for('update')
      .limit(1);
    if (!before) throw new AppError('NOT_FOUND');
    const startsAt = v.startsAt ?? new Date(before.startsAt);
    const endsAt = v.endsAt ?? new Date(before.endsAt);
    if (endsAt <= startsAt) throw new ValidationError({ endsAt: ['after_starts_at'] });
    if (v.startsAt || v.endsAt) {
      const collision = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            ne(appointments.id, id),
            ne(appointments.status, 'cancelled'),
            lt(appointments.startsAt, endsAt.toISOString()),
            gt(appointments.endsAt, startsAt.toISOString())
          )
        )
        .limit(1);
      if (collision.length) throw new AppError('CONFLICT');
    }
    const [after] = await tx
      .update(appointments)
      .set({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        ...(v.status !== undefined ? { status: v.status } : {}),
        ...(v.notes !== undefined ? { notes: v.notes } : {}),
        updatedAt: sql`now()`
      })
      .where(eq(appointments.id, id))
      .returning();
    await audit(tx, {
      action: v.status === 'cancelled' ? 'appointment.cancel' : 'appointment.update',
      entity: 'appointment',
      entityId: id,
      before: { startsAt: before.startsAt, endsAt: before.endsAt, status: before.status },
      after: { startsAt: after.startsAt, endsAt: after.endsAt, status: after.status }
    });
    await emitEvent(tx, {
      name: `appointment.${v.status === 'cancelled' ? 'cancelled' : 'updated'}`,
      tenantId: ctx.tenantId,
      actor: { type: 'user', id: ctx.userId },
      payload: { appointmentId: id }
    });
    return after;
  });
}

export function cancelAppointment(
  ctx: TenantContextInput,
  id: string,
  opts: { db?: Db; tx?: Tx } = {}
) {
  return updateAppointment(ctx, id, { status: 'cancelled' }, opts);
}

export async function listAppointments(
  ctx: TenantContextInput,
  from: Date,
  to: Date,
  opts: { db?: Db; tx?: Tx } = {}
) {
  if (!(from < to)) throw new ValidationError({ range: ['invalid'] });
  return run(ctx, opts, (tx) =>
    tx
      .select({ appointment: appointments, contactName: sql<string | null>`null` })
      .from(appointments)
      .where(
        and(
          lt(appointments.startsAt, to.toISOString()),
          gt(appointments.endsAt, from.toISOString()),
          ne(appointments.status, 'cancelled')
        )
      )
      .orderBy(appointments.startsAt)
  );
}

export { type BusinessHours };
