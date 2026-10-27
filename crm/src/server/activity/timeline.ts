import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Tx } from '../db/client';
import { activities, users } from '../db/schema';
import { withTenant, type TenantContextInput } from '../tenancy';
import { FIELD_LIMITS, parseInput } from '../validation';
import { ValidationError } from '../errors';
import { ACTIVITY_TYPES, ACTOR_TYPES, type ActivityType } from './types';

// Activities read API (M3-01; PRD F-19). One timeline per contact or deal, newest first, with an
// optional type filter and keyset paging. Runs through withTenant, so RLS keeps another tenant's
// rows out and a missing or foreign entity id reads as an empty timeline.

export type TimelineOpts = { db?: Db; tx?: Tx };

const uuid = z.string().uuid();

export const listActivitiesSchema = z
  .strictObject({
    contactId: uuid.optional(),
    dealId: uuid.optional(),
    types: z.array(z.enum(ACTIVITY_TYPES)).max(ACTIVITY_TYPES.length).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(FIELD_LIMITS.listLimitMax)
      .default(FIELD_LIMITS.listLimitDefault),
    cursor: z.string().min(1).max(200).optional()
  })
  .refine((v) => Boolean(v.contactId) !== Boolean(v.dealId), {
    message: 'Pass exactly one of contactId or dealId.',
    path: ['contactId']
  });
export type ListActivitiesInput = z.input<typeof listActivitiesSchema>;

export type TimelineItem = {
  id: string;
  type: ActivityType;
  summary: string;
  actor: {
    type: (typeof ACTOR_TYPES)[number];
    id: string | null;
    name: string | null;
  };
  occurredAt: string;
  refTable: string | null;
  refId: string | null;
  contactId: string | null;
  dealId: string | null;
};
export type TimelinePage = { items: TimelineItem[]; nextCursor: string | null };

const cursorSchema = z.object({ at: z.string().min(1), id: uuid });

const encodeCursor = (at: string, id: string) =>
  Buffer.from(JSON.stringify({ at, id })).toString('base64url');

function decodeCursor(raw: string): z.infer<typeof cursorSchema> {
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    if (Number.isNaN(Date.parse(parsed.at))) throw new Error('bad date');
    return parsed;
  } catch {
    throw new ValidationError({ cursor: ['invalid'] });
  }
}

/**
 * One page of a contact's or deal's timeline. `nextCursor` is null on the last page. A `user`
 * actor carries the person's name so the UI can say who did it; Alex and automation items carry
 * their type only, which the UI labels distinctly (DESIGN_SYSTEM, Timeline).
 */
export async function listActivities(
  ctx: TenantContextInput,
  input: ListActivitiesInput,
  opts: TimelineOpts = {}
): Promise<TimelinePage> {
  const v = parseInput(listActivitiesSchema, input);
  const cursor = v.cursor ? decodeCursor(v.cursor) : null;

  const read = async (tx: Tx): Promise<TimelinePage> => {
    const where: (SQL | undefined)[] = [
      v.contactId ? eq(activities.contactId, v.contactId) : eq(activities.dealId, v.dealId!),
      v.types?.length ? inArray(activities.type, v.types) : undefined,
      cursor
        ? sql`(${activities.occurredAt}, ${activities.id}) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
        : undefined
    ];
    const rows = await tx
      .select({
        id: activities.id,
        type: activities.type,
        summary: activities.summary,
        actorType: activities.actorType,
        actorId: activities.actorId,
        actorName: users.name,
        occurredAt: activities.occurredAt,
        refTable: activities.refTable,
        refId: activities.refId,
        contactId: activities.contactId,
        dealId: activities.dealId
      })
      .from(activities)
      .leftJoin(users, eq(users.id, activities.actorId))
      .where(and(...where))
      .orderBy(desc(activities.occurredAt), desc(activities.id))
      .limit(v.limit + 1);

    const page = rows.slice(0, v.limit);
    const last = page.at(-1);
    return {
      items: page.map((r) => ({
        id: r.id,
        type: r.type as ActivityType,
        summary: r.summary,
        actor: {
          type: r.actorType as TimelineItem['actor']['type'],
          id: r.actorId,
          name: r.actorType === 'user' ? r.actorName : null
        },
        occurredAt: r.occurredAt,
        refTable: r.refTable,
        refId: r.refId,
        contactId: r.contactId,
        dealId: r.dealId
      })),
      nextCursor: rows.length > v.limit && last ? encodeCursor(last.occurredAt, last.id) : null
    };
  };
  return opts.tx ? read(opts.tx) : withTenant(ctx, read, { db: opts.db });
}
