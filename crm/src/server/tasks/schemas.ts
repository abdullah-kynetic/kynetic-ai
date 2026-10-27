import { z } from 'zod';
import { FIELD_LIMITS, uuidSchema } from '../validation';

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

const fields = {
  title: z.string().trim().min(1).max(FIELD_LIMITS.name),
  /** An instant. The UI converts the typed local time with the tenant zone first. */
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  assigneeId: uuidSchema.nullable(),
  contactId: uuidSchema.nullable(),
  dealId: uuidSchema.nullable(),
  priority: z.enum(TASK_PRIORITIES)
};

export const createTaskSchema = z.strictObject({
  title: fields.title,
  dueAt: fields.dueAt.optional(),
  assigneeId: fields.assigneeId.optional(),
  contactId: fields.contactId.optional(),
  dealId: fields.dealId.optional(),
  priority: fields.priority.default('normal')
});
export type CreateTaskInput = z.input<typeof createTaskSchema>;

export const updateTaskSchema = z.strictObject(fields).partial();
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const listMyTasksSchema = z.strictObject({
  /** `mine` is the signed-in user's open tasks; `all` is every open task in the tenant. */
  scope: z.enum(['mine', 'all']).default('mine')
});
export type ListMyTasksInput = z.input<typeof listMyTasksSchema>;

export const listEntityTasksSchema = z
  .strictObject({
    contactId: uuidSchema.optional(),
    dealId: uuidSchema.optional(),
    /** How many completed tasks to append after the open ones. */
    completedLimit: z.number().int().min(0).max(50).default(5)
  })
  .refine((v) => Boolean(v.contactId) !== Boolean(v.dealId), {
    message: 'contact_or_deal',
    path: ['contactId']
  });
export type ListEntityTasksInput = z.input<typeof listEntityTasksSchema>;
