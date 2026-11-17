import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { deals, tasks } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { createTask, updateTask } from '../tasks/service';
import { TASK_PRIORITIES } from '../tasks/schemas';
import type { ServiceContext } from '../service-auth/authenticate';
import { plainNote } from './call-log';
import { contactExists } from './reads';

// POST /api/service/tasks and PATCH /api/service/tasks/{id}. Create and edit only: no complete, reopen or
// delete. The title is untrusted text: it is reduced to plain text and must be read as data. A task made
// here is a system action and queues no due reminder, so nothing is notified or emailed.

const title = z.string().min(1).max(200);
const dueAt = z.iso.datetime({ offset: true }).nullable();

export const serviceTaskCreateSchema = z.strictObject({
  title,
  dueAt: dueAt.optional(),
  assigneeId: z.uuid().nullable().optional(),
  contactId: z.uuid().nullable().optional(),
  dealId: z.uuid().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional()
});
export type ServiceTaskCreateInput = z.output<typeof serviceTaskCreateSchema>;

export const serviceTaskUpdateSchema = z
  .strictObject({
    title,
    dueAt,
    assigneeId: z.uuid().nullable(),
    contactId: z.uuid().nullable(),
    dealId: z.uuid().nullable(),
    priority: z.enum(TASK_PRIORITIES)
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'empty' });
export type ServiceTaskUpdateInput = z.output<typeof serviceTaskUpdateSchema>;

const cleanTitle = (raw: string) => {
  const t = plainNote(raw);
  if (!t) throw new ValidationError({ title: ['required'] });
  return t;
};

/** A contact or deal of another tenant, or a deleted one, is a 404 (RLS hides foreign rows). */
async function linksExist(tx: Tx, contactId?: string | null, dealId?: string | null) {
  if (contactId) await contactExists(tx, contactId);
  if (dealId) {
    const [d] = await tx
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.id, dealId), isNull(deals.deletedAt)))
      .limit(1);
    if (!d) throw new AppError('NOT_FOUND');
  }
}

async function taskDto(tx: Tx, id: string) {
  const [r] = await tx
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
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .limit(1);
  if (!r) throw new AppError('NOT_FOUND');
  return { ...r, status: r.completedAt ? 'done' : 'open' };
}

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });

/** Runs inside withServiceTenant. */
export async function createServiceTask(
  tx: Tx,
  svc: ServiceContext,
  input: ServiceTaskCreateInput
) {
  const clean = cleanTitle(input.title);
  await linksExist(tx, input.contactId, input.dealId);
  const row = await createTask(
    sysCtx(svc),
    { ...input, title: clean },
    { tx, origin: 'service-api' }
  );
  return taskDto(tx, row.id);
}

/** Runs inside withServiceTenant. A task of another tenant is a 404 with nothing written. */
export async function updateServiceTask(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  input: ServiceTaskUpdateInput
) {
  await taskDto(tx, id);
  await linksExist(tx, input.contactId, input.dealId);
  const patch = input.title === undefined ? input : { ...input, title: cleanTitle(input.title) };
  await updateTask(sysCtx(svc), id, patch, { tx, origin: 'service-api' });
  const data = await taskDto(tx, id);
  return { data, fields: Object.keys(input) };
}
