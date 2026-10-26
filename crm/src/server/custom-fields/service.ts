import { asc, eq, sql } from 'drizzle-orm';
import { audit } from '../audit';
import type { Db, Tx } from '../db/client';
import { companies, contacts, customFieldDefs, deals } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';
import { FIELD_LIMITS, parseInput, uuidSchema } from '../validation';
import {
  createFieldDefSchema,
  reorderFieldDefsSchema,
  updateFieldDefSchema,
  type CreateFieldDefInput,
  type UpdateFieldDefInput
} from './schemas';
import {
  checkCustomValues,
  isSelectType,
  type CustomFieldDef,
  type CustomFieldEntity,
  type CustomValue
} from './types';

// Custom fields service (M1-06; PRD F-12, F-43; DATABASE custom_field_defs). CRM Full only: every
// function starts with requireModule(crm, full), so a Lite tenant gets 403 MODULE_DISABLED and
// nothing is written. Definitions are edited by owners and Kynetic admins (SECURITY 2.2 "custom
// fields"); everyone with tenant data access reads them. RLS keeps both inside the caller's tenant.

export type CustomFieldOpts = { db?: Db; tx?: Tx };

function run<T>(ctx: TenantContextInput, opts: CustomFieldOpts, fn: (tx: Tx) => Promise<T>) {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}

const needFull = async (ctx: TenantContextInput, tx: Tx) =>
  requireModule(ctx, 'crm', { level: 'full', tx });

function needWriter(ctx: TenantContextInput) {
  if (ctx.role !== 'owner' && ctx.role !== 'admin') throw new AppError('FORBIDDEN');
}

const toDef = (r: typeof customFieldDefs.$inferSelect): CustomFieldDef => ({
  id: r.id,
  entity: r.entity as CustomFieldEntity,
  key: r.key,
  label: r.label,
  type: r.type as CustomFieldDef['type'],
  options: Array.isArray(r.options) ? (r.options as string[]) : [],
  showInTable: r.showInTable,
  filterable: r.filterable,
  importable: r.importable,
  position: r.position
});

async function defsIn(tx: Tx, entity?: CustomFieldEntity): Promise<CustomFieldDef[]> {
  const rows = await tx
    .select()
    .from(customFieldDefs)
    .where(entity ? eq(customFieldDefs.entity, entity) : undefined)
    .orderBy(
      asc(customFieldDefs.entity),
      asc(customFieldDefs.position),
      asc(customFieldDefs.label)
    );
  return rows.map(toDef);
}

/** The tenant's definitions in display order, for one entity or all of them. */
export async function listFieldDefs(
  ctx: TenantContextInput,
  entity?: CustomFieldEntity,
  opts: CustomFieldOpts = {}
): Promise<CustomFieldDef[]> {
  return run(ctx, opts, async (tx) => {
    await needFull(ctx, tx);
    return defsIn(tx, entity);
  });
}

export async function createFieldDef(
  ctx: TenantContextInput,
  input: CreateFieldDefInput,
  opts: CustomFieldOpts = {}
): Promise<CustomFieldDef> {
  const v = parseInput(createFieldDefSchema, input);
  return run(ctx, opts, async (tx) => {
    await needFull(ctx, tx);
    needWriter(ctx);
    const existing = await defsIn(tx, v.entity);
    if (existing.length >= FIELD_LIMITS.customFieldsPerEntity) {
      throw new ValidationError({ entity: ['too_many_fields'] });
    }
    if (existing.some((d) => d.key === v.key)) {
      throw new ValidationError({ key: ['key_in_use'] });
    }
    const [row] = await tx
      .insert(customFieldDefs)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        entity: v.entity,
        key: v.key,
        label: v.label,
        type: v.type,
        options: v.options,
        showInTable: v.showInTable,
        filterable: v.filterable,
        importable: v.importable,
        position: existing.reduce((n, d) => Math.max(n, d.position + 1), 0)
      })
      .returning();
    await audit(tx, {
      action: 'custom_field.create',
      entity: 'custom_field_def',
      entityId: row.id,
      after: { entity: v.entity, key: v.key, type: v.type }
    });
    return toDef(row);
  });
}

async function loadDef(tx: Tx, id: string) {
  const [row] = await tx.select().from(customFieldDefs).where(eq(customFieldDefs.id, id)).limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  return row;
}

/** Label, options and the show, filter and import flags. Key and type are fixed once created. */
export async function updateFieldDef(
  ctx: TenantContextInput,
  id: string,
  patch: UpdateFieldDefInput,
  opts: CustomFieldOpts = {}
): Promise<CustomFieldDef> {
  parseInput(uuidSchema, id);
  const v = parseInput(updateFieldDefSchema, patch);
  return run(ctx, opts, async (tx) => {
    await needFull(ctx, tx);
    needWriter(ctx);
    const before = await loadDef(tx, id);
    if (v.options !== undefined) {
      if (!isSelectType(before.type as CustomFieldDef['type'])) {
        throw new ValidationError({ options: ['options_not_allowed'] });
      }
      if (v.options.length === 0) throw new ValidationError({ options: ['options_required'] });
    }
    const [after] = await tx
      .update(customFieldDefs)
      .set(v)
      .where(eq(customFieldDefs.id, id))
      .returning();
    const changed = (Object.keys(v) as (keyof typeof v)[]).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );
    if (changed.length) {
      await audit(tx, {
        action: 'custom_field.update',
        entity: 'custom_field_def',
        entityId: id,
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, after[k]]))
      });
    }
    return toDef(after);
  });
}

/** Sets the display order of one entity's fields to the given ids (all of them, in order). */
export async function reorderFieldDefs(
  ctx: TenantContextInput,
  input: { entity: CustomFieldEntity; ids: string[] },
  opts: CustomFieldOpts = {}
): Promise<CustomFieldDef[]> {
  const v = parseInput(reorderFieldDefsSchema, input);
  return run(ctx, opts, async (tx) => {
    await needFull(ctx, tx);
    needWriter(ctx);
    const current = await defsIn(tx, v.entity);
    const same =
      current.length === v.ids.length &&
      current.every((d) => v.ids.includes(d.id)) &&
      new Set(v.ids).size === v.ids.length;
    if (!same) throw new ValidationError({ ids: ['must_list_every_field_once'] });
    for (const [position, id] of v.ids.entries()) {
      await tx.update(customFieldDefs).set({ position }).where(eq(customFieldDefs.id, id));
    }
    await audit(tx, {
      action: 'custom_field.reorder',
      entity: 'custom_field_def',
      after: { entity: v.entity, ids: v.ids }
    });
    return defsIn(tx, v.entity);
  });
}

/**
 * Deletes a definition and removes its values from every row of that entity, in one transaction, so
 * a later field with the same key cannot inherit stale values of another type.
 */
export async function deleteFieldDef(
  ctx: TenantContextInput,
  id: string,
  opts: CustomFieldOpts = {}
): Promise<void> {
  parseInput(uuidSchema, id);
  await run(ctx, opts, async (tx) => {
    await needFull(ctx, tx);
    needWriter(ctx);
    const row = await loadDef(tx, id);
    const strip = { contact: contacts, company: companies, deal: deals }[
      row.entity as CustomFieldEntity
    ];
    await tx
      .update(strip)
      .set({ custom: sql`${strip.custom} - ${row.key}::text` })
      .where(sql`${strip.custom} ? ${row.key}`);
    await tx.delete(customFieldDefs).where(eq(customFieldDefs.id, id));
    await audit(tx, {
      action: 'custom_field.delete',
      entity: 'custom_field_def',
      entityId: id,
      before: { entity: row.entity, key: row.key, type: row.type }
    });
  });
}

/**
 * The write-side check for a `custom` object on a contact, company or deal. Rejects unknown keys and
 * values that do not match the declared type or options (SECURITY 5.1), and returns the cleaned
 * object with empty values dropped. An empty object passes without a module check; any key needs
 * CRM Full, so a Lite tenant is refused with 403 before anything is written.
 */
export async function validateCustomValues(
  ctx: TenantContextInput,
  tx: Tx,
  entity: CustomFieldEntity,
  raw: Record<string, unknown>
): Promise<Record<string, CustomValue>> {
  if (Object.keys(raw).length === 0) return {};
  await needFull(ctx, tx);
  const result = checkCustomValues(await defsIn(tx, entity), raw);
  if (!result.ok) throw new ValidationError(result.errors);
  return result.values;
}
