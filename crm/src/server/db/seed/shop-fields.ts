import type postgres from 'postgres';
import { AUTO_BODY_FIELDS } from '../../shop/custom-fields';

export type ShopFieldsResult = {
  slug: string;
  status: 'planned' | 'applied' | 'no-module' | 'no-tenant';
  missing: string[];
  existing: string[];
};

/**
 * Creates any missing auto body deal fields for a tenant that has the shop module on. Dry run unless
 * `apply`. A field that already exists, even one the client renamed, is left exactly as it is.
 */
export async function ensureShopFields(
  sql: postgres.Sql,
  opts: { slug?: string; apply?: boolean } = {}
): Promise<ShopFieldsResult> {
  const slug = opts.slug ?? 'aa-auto-body-shop';
  const [tenant] = await sql<{ id: string }[]>`select id from tenants where slug = ${slug}`;
  if (!tenant) return { slug, status: 'no-tenant', missing: [], existing: [] };
  const [mod] = await sql<{ enabled: boolean }[]>`
    select enabled from tenant_modules where tenant_id = ${tenant.id} and module_key = 'shop_ops'`;
  if (!mod?.enabled) return { slug, status: 'no-module', missing: [], existing: [] };
  const have = new Set(
    (
      await sql<{ key: string }[]>`
        select key from custom_field_defs where tenant_id = ${tenant.id} and entity = 'deal'`
    ).map((r) => r.key)
  );
  const existing = AUTO_BODY_FIELDS.filter((f) => have.has(f.key)).map((f) => f.key);
  const missing = AUTO_BODY_FIELDS.filter((f) => !have.has(f.key));
  if (!opts.apply) return { slug, status: 'planned', missing: missing.map((f) => f.key), existing };
  await sql.begin(async (tx) => {
    const [pos] = await tx<{ next: number }[]>`
      select coalesce(max(position) + 1, 0)::int as next from custom_field_defs
      where tenant_id = ${tenant.id} and entity = 'deal'`;
    let position = pos!.next;
    for (const f of missing) {
      const spec = f as {
        key: string;
        label: string;
        type: string;
        options?: readonly string[];
        showInTable?: boolean;
        filterable?: boolean;
      };
      await tx`
        insert into custom_field_defs
          (tenant_id, entity, key, label, type, options, show_in_table, filterable, importable, position)
        values (${tenant.id}, 'deal', ${spec.key}, ${spec.label}, ${spec.type},
          ${tx.json([...(spec.options ?? [])])}, ${spec.showInTable ?? false},
          ${spec.filterable ?? false}, true, ${position++})
        on conflict (tenant_id, entity, key) do nothing`;
    }
  });
  return { slug, status: 'applied', missing: missing.map((f) => f.key), existing };
}
