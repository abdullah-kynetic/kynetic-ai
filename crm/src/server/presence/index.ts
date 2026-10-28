import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import type { Actor } from '../auth/permissions';
import type { Db, Tx } from '../db/client';
import { presenceItems, reviewSnapshots } from '../db/schema';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';

const itemSchema = z.strictObject({
  kind: z.enum(['profile', 'review_site', 'directory', 'social_post']),
  title: z.string().trim().min(1).max(200),
  status: z.enum(['planned', 'in_progress', 'done', 'needs_attention']),
  notes: z.string().max(5000).default('')
});
export type PresenceItemInput = z.input<typeof itemSchema>;
const snapshotSchema = z.strictObject({ source: z.string().trim().min(1).max(200), capturedOn: z.iso.date(), reviewCount: z.number().int().min(0), averageRating: z.number().min(0).max(5).nullable() });
type Opts = { db?: Db; tx?: Tx };

export async function listPresence(ctx: TenantContextInput, opts: Opts = {}) {
  const read = async (tx: Tx) => {
    await requireModule(ctx, 'opm', { tx });
    const [items, reviews] = await Promise.all([
      tx.select().from(presenceItems).orderBy(desc(presenceItems.updatedAt)),
      tx.select().from(reviewSnapshots).orderBy(desc(reviewSnapshots.capturedOn))
    ]);
    return { items, reviews };
  };
  return opts.tx ? read(opts.tx) : withTenant(ctx, read, { db: opts.db });
}

export async function saveReviewSnapshot(ctx: TenantContextInput, actor: Actor, input: z.input<typeof snapshotSchema>, opts: Opts = {}) {
  if (actor.kyneticRole !== 'admin' || actor.userId !== ctx.userId || ctx.role !== 'admin' || ctx.readOnly) throw new AppError('FORBIDDEN');
  const value = parseInput(snapshotSchema, input);
  const write = async (tx: Tx) => {
    await requireModule(ctx, 'opm', { tx });
    const [row] = await tx.insert(reviewSnapshots).values({ ...value, tenantId: ctx.tenantId, averageRating: value.averageRating?.toFixed(2) ?? null })
      .onConflictDoUpdate({ target: [reviewSnapshots.tenantId, reviewSnapshots.source, reviewSnapshots.capturedOn], set: { reviewCount: value.reviewCount, averageRating: value.averageRating?.toFixed(2) ?? null } }).returning();
    await audit(tx, { action: 'presence.review_snapshot', entity: 'review_snapshot', entityId: row.id, after: { source: row.source, capturedOn: row.capturedOn, reviewCount: row.reviewCount, averageRating: row.averageRating } });
    return row;
  };
  return opts.tx ? write(opts.tx) : withTenant(ctx, write, { db: opts.db });
}

/** Only authenticated Kynetic admins acting in a tenant context may change OPM status. */
export async function savePresenceItem(ctx: TenantContextInput, actor: Actor, input: PresenceItemInput, id?: string, opts: Opts = {}) {
  if (actor.kyneticRole !== 'admin' || actor.userId !== ctx.userId || ctx.role !== 'admin' || ctx.readOnly) throw new AppError('FORBIDDEN');
  const value = parseInput(itemSchema, input);
  if (id) parseInput(z.uuid(), id);
  const write = async (tx: Tx) => {
    await requireModule(ctx, 'opm', { tx });
    const [before] = id ? await tx.select().from(presenceItems).where(and(eq(presenceItems.id, id), eq(presenceItems.tenantId, ctx.tenantId))).limit(1) : [];
    if (id && !before) throw new AppError('NOT_FOUND');
    const [row] = id
      ? await tx.update(presenceItems).set({ ...value, updatedAt: new Date().toISOString() }).where(and(eq(presenceItems.id, id), eq(presenceItems.tenantId, ctx.tenantId))).returning()
      : await tx.insert(presenceItems).values({ ...value, tenantId: ctx.tenantId }).returning();
    await audit(tx, { action: id ? 'presence.update' : 'presence.create', entity: 'presence_item', entityId: row.id, before: before ? { kind: before.kind, status: before.status } : undefined, after: { kind: row.kind, status: row.status } });
    return row;
  };
  return opts.tx ? write(opts.tx) : withTenant(ctx, write, { db: opts.db });
}
