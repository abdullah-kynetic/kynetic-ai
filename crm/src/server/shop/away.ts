import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { presenceItems } from '../db/schema';
import { AppError } from '../errors';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import type { AwaySettings } from './types';

/**
 * Where the setting lives. There is no settings table in the shop track (no new tables), and the
 * client role may only write a few tenant columns, so away mode is one `presence_items` row of kind
 * `profile` with this title and the settings as JSON in its notes. Get found hides it.
 */
export const AWAY_ITEM_TITLE = 'Away mode (shop setting)';

export const DEFAULT_AWAY: AwaySettings = {
  enabled: false,
  from: null,
  until: null,
  dailySummary: true,
  alerts: { urgentCalls: true, quoteReplies: true, pickupsWaiting: false }
};

const date = z.iso.date();
export const awaySchema = z
  .strictObject({
    enabled: z.boolean(),
    from: date.nullable(),
    until: date.nullable(),
    dailySummary: z.boolean(),
    alerts: z.strictObject({
      urgentCalls: z.boolean(),
      quoteReplies: z.boolean(),
      pickupsWaiting: z.boolean()
    })
  })
  .refine((v) => !v.enabled || (v.from !== null && v.until !== null), {
    message: 'Pick the first and last day away.',
    path: ['from']
  })
  .refine((v) => v.from === null || v.until === null || v.until >= v.from, {
    message: 'The last day cannot be before the first day.',
    path: ['until']
  });

export function readAway(notes: string | null | undefined): AwaySettings {
  let raw: unknown = {};
  try {
    raw = notes ? JSON.parse(notes) : {};
  } catch {
    raw = {};
  }
  const parsed = awaySchema.safeParse({ ...DEFAULT_AWAY, ...(raw as object) });
  return parsed.success ? parsed.data : DEFAULT_AWAY;
}

const itemWhere = and(eq(presenceItems.kind, 'profile'), eq(presenceItems.title, AWAY_ITEM_TITLE));

/** Reads away mode. A client that never saved it reads as off. */
export async function getAwaySettings(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<AwaySettings> {
  return shopRun(ctx, opts, async (tx) => {
    const [row] = await tx
      .select({ notes: presenceItems.notes })
      .from(presenceItems)
      .where(itemWhere)
      .limit(1);
    return readAway(row?.notes);
  });
}

export class AwayValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>) {
    super('Away mode settings are not valid.');
  }
}

/**
 * Saves away mode. This stores the setting and an audit row, and nothing else: no message, call,
 * pause or job is created, so turning it on changes what the page shows and nothing outside it.
 */
export async function saveAwaySettings(
  ctx: TenantContextInput,
  input: unknown,
  opts: ShopOpts = {}
): Promise<AwaySettings> {
  if (ctx.readOnly || !ctx.userId) throw new AppError('FORBIDDEN');
  const parsed = awaySchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      errors[String(issue.path[0] ?? 'form')] ??= issue.message;
    throw new AwayValidationError(errors);
  }
  return shopRun(ctx, opts, async (tx) => {
    const [before] = await tx
      .select({ id: presenceItems.id, notes: presenceItems.notes })
      .from(presenceItems)
      .where(itemWhere)
      .limit(1);
    const notes = JSON.stringify(parsed.data);
    if (before)
      await tx
        .update(presenceItems)
        .set({ notes, updatedAt: sql`now()` })
        .where(eq(presenceItems.id, before.id));
    else
      await tx.insert(presenceItems).values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        kind: 'profile',
        title: AWAY_ITEM_TITLE,
        status: 'planned',
        notes
      });
    await audit(tx, {
      action: 'shop.away.save',
      entity: 'tenant',
      entityId: ctx.tenantId,
      before: readAway(before?.notes),
      after: parsed.data
    });
    return parsed.data;
  });
}
