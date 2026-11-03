import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { activities } from '../db/schema';
import { ACTIVITY_TYPES, ACTOR_TYPES } from './types';

export { ACTIVITY_TYPES, ACTOR_TYPES, type ActivityType } from './types';
export type ActivityActor = {
  type: (typeof ACTOR_TYPES)[number];
  id?: string | null;
};

const uuid = z.string().uuid();
const inputSchema = z.object({
  contactId: uuid.nullish(),
  dealId: uuid.nullish(),
  companyId: uuid.nullish(),
  type: z.enum(ACTIVITY_TYPES),
  refTable: z.string().min(1).nullish(),
  refId: uuid.nullish(),
  summary: z.string().trim().min(1),
  actor: z.object({ type: z.enum(ACTOR_TYPES), id: uuid.nullish() }),
  occurredAt: z.date().optional(),
  meta: z.record(z.string(), z.unknown()).optional()
});

export type RecordActivityInput = z.input<typeof inputSchema>;

/**
 * Writes one activity row inside the caller's transaction (ARCHITECTURE section 2). The tenant
 * comes from the transaction's context, so a caller cannot write into another tenant; the row
 * commits or rolls back with the write it describes. Run it through withTenant.
 */
export async function recordActivity(tx: Tx, input: RecordActivityInput): Promise<{ id: string }> {
  const i = inputSchema.parse(input);
  const [row] = await tx
    .insert(activities)
    .values({
      tenantId: sql`app_tenant_id()`,
      contactId: i.contactId ?? null,
      dealId: i.dealId ?? null,
      companyId: i.companyId ?? null,
      type: i.type,
      refTable: i.refTable ?? null,
      refId: i.refId ?? null,
      summary: i.summary,
      actorType: i.actor.type,
      actorId: i.actor.id ?? null,
      ...(i.occurredAt ? { occurredAt: i.occurredAt.toISOString() } : {}),
      ...(i.meta ? { meta: i.meta } : {})
    })
    .returning({ id: activities.id });
  return row;
}

export {
  listActivities,
  listActivitiesSchema,
  type ListActivitiesInput,
  type TimelineItem,
  type TimelinePage
} from './timeline';
