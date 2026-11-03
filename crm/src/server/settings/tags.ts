import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { can, type Actor } from '../auth/permissions';
import type { Db, Tx } from '../db/client';
import { tags } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { isModuleEnabled } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';

// Tag settings (M9-11; PRD F-43). A CRM Lite surface. Tags live on contacts (`contacts.tags`); the
// `tags` table only lets an owner create a tag before it is used. The list is the union of both, so a
// tag applied from a contact page shows up here too. Rename and delete rewrite every contact that has
// the tag (soft-deleted ones included, so a restore brings back the new name) in one transaction and
// are audited once with the contact count.

export type TagOpts = { db?: Db; tx?: Tx };
export type TagRow = { name: string; contactCount: number; registered: boolean };

const nameSchema = z.string().trim().min(1).max(50);
const createSchema = z.strictObject({ name: nameSchema });
const renameSchema = z.strictObject({ from: nameSchema, to: nameSchema });
const deleteSchema = z.strictObject({ name: nameSchema });
export type CreateTagInput = z.input<typeof createSchema>;
export type RenameTagInput = z.input<typeof renameSchema>;
export type DeleteTagInput = z.input<typeof deleteSchema>;

const run = <T>(ctx: TenantContextInput, opts: TagOpts, fn: (tx: Tx) => Promise<T>) =>
  opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });

async function requireLite(ctx: TenantContextInput, opts: TagOpts) {
  if (!(await isModuleEnabled(ctx, 'crm', { level: 'lite', db: opts.db }))) {
    throw new AppError('MODULE_DISABLED');
  }
}

/** Tags are owner and admin settings, the same matrix row as pipelines (SECURITY 2.2). */
function requireWrite(actor: Actor, ctx: TenantContextInput) {
  if (!can(actor, 'settings.business', ctx.tenantId)) throw new AppError('FORBIDDEN');
}

async function listIn(tx: Tx): Promise<TagRow[]> {
  const registered = await tx.select({ name: tags.name }).from(tags);
  const used = (await tx.execute(sql`
    select min(t) as name, count(*)::int as n
    from contacts c, unnest(c.tags) as t
    where c.deleted_at is null
    group by lower(t)`)) as unknown as { name: string; n: number }[];
  const byKey = new Map<string, TagRow>();
  for (const r of registered) {
    byKey.set(r.name.toLowerCase(), { name: r.name, contactCount: 0, registered: true });
  }
  for (const u of used) {
    const key = u.name.toLowerCase();
    const cur = byKey.get(key);
    if (cur) cur.contactCount = u.n;
    else byKey.set(key, { name: u.name, contactCount: u.n, registered: false });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

export async function listTags(ctx: TenantContextInput, opts: TagOpts = {}): Promise<TagRow[]> {
  await requireLite(ctx, opts);
  return run(ctx, opts, listIn);
}

export async function createTag(
  ctx: TenantContextInput,
  actor: Actor,
  input: CreateTagInput,
  opts: TagOpts = {}
): Promise<TagRow[]> {
  await requireLite(ctx, opts);
  requireWrite(actor, ctx);
  const v = parseInput(createSchema, input);
  return run(ctx, opts, async (tx) => {
    const [row] = await tx
      .insert(tags)
      .values({ tenantId: sql`app_tenant_id()` as unknown as string, name: v.name })
      .onConflictDoNothing()
      .returning({ id: tags.id });
    if (!row) throw new ValidationError({ name: ['duplicate'] });
    await audit(tx, {
      action: 'tag.create',
      entity: 'tag',
      entityId: row.id,
      after: { name: v.name }
    });
    return listIn(tx);
  });
}

/** Rewrites the tag on every contact that has it, ignoring case, and drops repeats the rewrite makes. */
async function rewriteContacts(tx: Tx, from: string, to: string | null): Promise<number> {
  const rows = (await tx.execute(sql`
    update contacts set updated_at = now(), tags = coalesce((
      select array_agg(v order by o) from (
        select distinct on (lower(v)) v, o from (
          select case when lower(t) = lower(${from}) then ${to} else t end as v, o
          from unnest(contacts.tags) with ordinality as u(t, o)
        ) s where v is not null order by lower(v), o
      ) d), '{}')
    where exists (select 1 from unnest(contacts.tags) t where lower(t) = lower(${from}))
    returning id`)) as unknown as unknown[];
  return rows.length;
}

/**
 * Renames a tag everywhere. Renaming onto a tag that already exists merges the two. Changing only the
 * letter case is allowed and re-spells the tag.
 */
export async function renameTag(
  ctx: TenantContextInput,
  actor: Actor,
  input: RenameTagInput,
  opts: TagOpts = {}
): Promise<TagRow[]> {
  await requireLite(ctx, opts);
  requireWrite(actor, ctx);
  const v = parseInput(renameSchema, input);
  return run(ctx, opts, async (tx) => {
    const list = await listIn(tx);
    const found = list.find((t) => t.name.toLowerCase() === v.from.toLowerCase());
    if (!found) throw new AppError('NOT_FOUND');
    const merged =
      v.to.toLowerCase() !== v.from.toLowerCase() &&
      list.some((t) => t.name.toLowerCase() === v.to.toLowerCase());
    const contactsChanged = await rewriteContacts(tx, v.from, v.to);
    await tx.delete(tags).where(sql`lower(${tags.name}) = lower(${v.from})`);
    await tx
      .insert(tags)
      .values({ tenantId: sql`app_tenant_id()` as unknown as string, name: v.to })
      .onConflictDoNothing();
    await audit(tx, {
      action: 'tag.rename',
      entity: 'tag',
      entityId: v.to,
      before: { name: found.name },
      after: { name: v.to, merged, contactsChanged }
    });
    return listIn(tx);
  });
}

/** Removes the tag from every contact and from the registry. Contacts themselves are untouched. */
export async function deleteTag(
  ctx: TenantContextInput,
  actor: Actor,
  input: DeleteTagInput,
  opts: TagOpts = {}
): Promise<TagRow[]> {
  await requireLite(ctx, opts);
  requireWrite(actor, ctx);
  const v = parseInput(deleteSchema, input);
  return run(ctx, opts, async (tx) => {
    const found = (await listIn(tx)).find((t) => t.name.toLowerCase() === v.name.toLowerCase());
    if (!found) throw new AppError('NOT_FOUND');
    const contactsChanged = await rewriteContacts(tx, v.name, null);
    await tx
      .delete(tags)
      .where(
        and(sql`lower(${tags.name}) = lower(${v.name})`, eq(tags.tenantId, sql`app_tenant_id()`))
      );
    await audit(tx, {
      action: 'tag.delete',
      entity: 'tag',
      entityId: found.name,
      before: { name: found.name },
      after: { contactsChanged }
    });
    return listIn(tx);
  });
}
