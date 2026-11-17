import { and, desc, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { appointments, calls, tasks } from '../db/schema';
import { decodeCursor, encodeCursor, pageShape, updatedSinceSchema } from './page';

// Read-only DTOs for tasks, calls and appointments. Whitelisted columns only: no transcript, recording,
// summary, extracted data or cost on calls; no address, notes or external event id on appointments.

const iso = z.iso.datetime({ offset: true }).optional();

export const taskListSchema = z.strictObject({
  ...pageShape,
  status: z.enum(['open', 'done']).optional(),
  contactId: z.uuid().optional(),
  dealId: z.uuid().optional(),
  dueBefore: iso,
  updatedSince: updatedSinceSchema
});

export async function listTasksDto(tx: Tx, q: z.output<typeof taskListSchema>) {
  const cursor = decodeCursor(q.cursor);
  const where: (SQL | undefined)[] = [
    isNull(tasks.deletedAt),
    q.status === 'open' ? isNull(tasks.completedAt) : undefined,
    q.status === 'done' ? isNotNull(tasks.completedAt) : undefined,
    q.contactId ? eq(tasks.contactId, q.contactId) : undefined,
    q.dealId ? eq(tasks.dealId, q.dealId) : undefined,
    q.dueBefore ? sql`${tasks.dueAt} <= ${q.dueBefore}::timestamptz` : undefined,
    q.updatedSince ? sql`${tasks.updatedAt} >= ${q.updatedSince}::timestamptz` : undefined,
    cursor
      ? sql`(${tasks.updatedAt}, ${tasks.id}) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
      : undefined
  ];
  const rows = await tx
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      assigneeId: tasks.assigneeId,
      contactId: tasks.contactId,
      dealId: tasks.dealId,
      priority: tasks.priority,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt
    })
    .from(tasks)
    .where(and(...where))
    .orderBy(desc(tasks.updatedAt), desc(tasks.id))
    .limit(q.limit + 1);
  const page = rows.slice(0, q.limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({ ...r, status: r.completedAt ? 'done' : 'open' })),
    nextCursor: rows.length > q.limit && last ? encodeCursor(last.updatedAt, last.id) : null
  };
}

export const CALL_OUTCOMES = [
  'booked',
  'qualified',
  'not_interested',
  'voicemail',
  'no_answer',
  'transferred',
  'dnc',
  'other'
] as const;

export const callListSchema = z.strictObject({
  ...pageShape,
  contactId: z.uuid().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  outcome: z.enum(CALL_OUTCOMES).optional(),
  startedSince: iso
});

export async function listCallsDto(tx: Tx, q: z.output<typeof callListSchema>) {
  const cursor = decodeCursor(q.cursor);
  const where: (SQL | undefined)[] = [
    q.contactId ? eq(calls.contactId, q.contactId) : undefined,
    q.direction ? eq(calls.direction, q.direction) : undefined,
    q.outcome ? eq(calls.outcome, q.outcome) : undefined,
    q.startedSince ? sql`${calls.startedAt} >= ${q.startedSince}::timestamptz` : undefined,
    cursor
      ? sql`(${calls.startedAt}, ${calls.id}) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
      : undefined
  ];
  const rows = await tx
    .select({
      id: calls.id,
      contactId: calls.contactId,
      dealId: calls.dealId,
      direction: calls.direction,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      durationS: calls.durationS,
      outcome: calls.outcome,
      sentiment: calls.sentiment,
      disclosureGiven: calls.disclosureGiven,
      flagged: calls.flagged
    })
    .from(calls)
    .where(and(...where))
    .orderBy(desc(calls.startedAt), desc(calls.id))
    .limit(q.limit + 1);
  const page = rows.slice(0, q.limit);
  const last = page.at(-1);
  return {
    items: page,
    nextCursor: rows.length > q.limit && last ? encodeCursor(last.startedAt, last.id) : null
  };
}

export const appointmentListSchema = z.strictObject({
  ...pageShape,
  contactId: z.uuid().optional(),
  status: z.enum(['scheduled', 'completed', 'no_show', 'cancelled']).optional(),
  from: iso,
  to: iso
});

export async function listAppointmentsDto(tx: Tx, q: z.output<typeof appointmentListSchema>) {
  const cursor = decodeCursor(q.cursor);
  const where: (SQL | undefined)[] = [
    q.contactId ? eq(appointments.contactId, q.contactId) : undefined,
    q.status ? eq(appointments.status, q.status) : undefined,
    q.from ? sql`${appointments.startsAt} >= ${q.from}::timestamptz` : undefined,
    q.to ? sql`${appointments.startsAt} < ${q.to}::timestamptz` : undefined,
    cursor
      ? sql`(${appointments.startsAt}, ${appointments.id}) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
      : undefined
  ];
  const rows = await tx
    .select({
      id: appointments.id,
      contactId: appointments.contactId,
      dealId: appointments.dealId,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      bookedBy: appointments.bookedBy,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt
    })
    .from(appointments)
    .where(and(...where))
    .orderBy(desc(appointments.startsAt), desc(appointments.id))
    .limit(q.limit + 1);
  const page = rows.slice(0, q.limit);
  const last = page.at(-1);
  return {
    items: page,
    nextCursor: rows.length > q.limit && last ? encodeCursor(last.startsAt, last.id) : null
  };
}
