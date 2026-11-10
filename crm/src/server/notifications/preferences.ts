import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Tx } from '../db/client';
import { notificationPreferences } from '../db/schema';
import { AppError } from '../errors';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';
import { EMAIL_OFF_BY_DEFAULT, NOTIFICATION_TYPES, type NotificationType } from './types';

// Per-user notification preferences (M9-11; PRD F-36, DC-115). The bell always shows every
// notification; a preference only controls the email. A missing row means email on. A user reads and
// writes only their own rows: RLS scopes to the tenant, and the user comes from the verified context.

export type PreferenceOpts = { db?: Db; tx?: Tx };
export type NotificationPreference = { kind: NotificationType; emailEnabled: boolean };

const setSchema = z.strictObject({
  preferences: z
    .array(z.strictObject({ kind: z.enum(NOTIFICATION_TYPES), emailEnabled: z.boolean() }))
    .min(1)
    .max(NOTIFICATION_TYPES.length)
});
export type SetPreferencesInput = z.input<typeof setSchema>;

const run = <T>(ctx: TenantContextInput, opts: PreferenceOpts, fn: (tx: Tx) => Promise<T>) =>
  opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });

function requireUser(ctx: TenantContextInput): string {
  if (!ctx.userId) throw new AppError('UNAUTHENTICATED');
  return ctx.userId;
}

const listIn = async (tx: Tx, userId: string): Promise<NotificationPreference[]> => {
  const rows = await tx
    .select({
      kind: notificationPreferences.kind,
      emailEnabled: notificationPreferences.emailEnabled
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  const saved = new Map(rows.map((r) => [r.kind, r.emailEnabled]));
  return NOTIFICATION_TYPES.map((kind) => ({
    kind,
    emailEnabled: saved.get(kind) ?? !EMAIL_OFF_BY_DEFAULT.has(kind)
  }));
};

/** Every notification type with the caller's choice; types never set are on. */
export async function listMyPreferences(
  ctx: TenantContextInput,
  opts: PreferenceOpts = {}
): Promise<NotificationPreference[]> {
  const userId = requireUser(ctx);
  return run(ctx, opts, (tx) => listIn(tx, userId));
}

export async function setMyPreferences(
  ctx: TenantContextInput,
  input: SetPreferencesInput,
  opts: PreferenceOpts = {}
): Promise<NotificationPreference[]> {
  const userId = requireUser(ctx);
  const v = parseInput(setSchema, input);
  return run(ctx, opts, async (tx) => {
    for (const p of v.preferences) {
      await tx
        .insert(notificationPreferences)
        .values({
          tenantId: sql`app_tenant_id()` as unknown as string,
          userId,
          kind: p.kind,
          emailEnabled: p.emailEnabled
        })
        .onConflictDoUpdate({
          target: [
            notificationPreferences.tenantId,
            notificationPreferences.userId,
            notificationPreferences.kind
          ],
          set: { emailEnabled: p.emailEnabled, updatedAt: sql`now()` }
        });
    }
    return listIn(tx, userId);
  });
}

/** Of these users, the ones who turned email off for this type. Used by the email worker. */
export async function usersWithEmailOff(
  tx: Tx,
  userIds: readonly string[],
  kind: string
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  if (EMAIL_OFF_BY_DEFAULT.has(kind as NotificationType)) {
    const on = await tx
      .select({ userId: notificationPreferences.userId })
      .from(notificationPreferences)
      .where(
        and(
          inArray(notificationPreferences.userId, [...userIds]),
          eq(notificationPreferences.kind, kind),
          eq(notificationPreferences.emailEnabled, true)
        )
      );
    const enabled = new Set(on.map((row) => row.userId));
    return new Set(userIds.filter((id) => !enabled.has(id)));
  }
  const rows = await tx
    .select({ userId: notificationPreferences.userId })
    .from(notificationPreferences)
    .where(
      and(
        inArray(notificationPreferences.userId, [...userIds]),
        eq(notificationPreferences.kind, kind),
        eq(notificationPreferences.emailEnabled, false)
      )
    );
  return new Set(rows.map((r) => r.userId));
}
