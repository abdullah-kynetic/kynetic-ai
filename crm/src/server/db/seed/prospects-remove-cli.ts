import postgres from 'postgres';

// Removes whole tenants by slug (for replacing a wrongly loaded prospect set).
// Usage: bun prospects-remove-cli.ts <slug> [<slug> ...] [--apply]
// Dry run by default: prints per-table row counts and changes nothing. DATABASE_URL_SEED must bypass RLS.
// audit_log is append-only by design and has no tenant foreign key, so its rows are kept (it is skipped).
// Run it inside a fresh pg_dump window; deleting is permanent.
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const slugs = args.filter((a) => !a.startsWith('--'));
const url = process.env.DATABASE_URL_SEED;
if (!url) {
  console.error('DATABASE_URL_SEED is not set');
  process.exit(1);
}
if (slugs.length === 0) {
  console.error('usage: prospects-remove-cli.ts <slug> [<slug> ...] [--apply]');
  process.exit(2);
}

const sql = postgres(url, { max: 1 });
try {
  const tenants = await sql`select id, slug, name from tenants where slug = any(${slugs})`;
  const missing = slugs.filter((s) => !tenants.some((t) => t.slug === s));
  if (missing.length) {
    console.error(`unknown slug(s), nothing changed: ${missing.join(', ')}`);
    process.exit(1);
  }
  const ids = tenants.map((t) => t.id as string);
  const idList = ids.map((i) => `'${i}'::uuid`).join(','); // ids come from the database, not from input
  const tables = await sql`select c.table_name as t from information_schema.columns c
    join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'tenant_id' order by 1`;
  const names = tables.map((r) => r.t as string).filter((n) => n !== 'audit_log');
  const counts: Record<string, number> = {};
  for (const n of names) {
    const [r] = await sql.unsafe(
      `select count(*)::int as n from "${n}" where tenant_id in (${idList})`
    );
    if (r!.n > 0) counts[n] = r!.n as number;
  }
  console.log(`tenants: ${tenants.map((t) => `${t.slug} (${t.name})`).join('; ')}`);
  console.log('rows to delete:', JSON.stringify(counts));
  if (!apply) {
    console.log('dry run, nothing changed. Re-run with --apply to delete.');
    process.exit(0);
  }
  await sql.begin(async (tx) => {
    // Child rows may reference each other, so retry the sweep until a full pass deletes cleanly.
    let pending = Object.keys(counts);
    for (let pass = 0; pass < 12 && pending.length; pass++) {
      const next: string[] = [];
      for (const n of pending) {
        try {
          await tx`savepoint s`;
          await tx.unsafe(`delete from "${n}" where tenant_id in (${idList})`);
          await tx`release savepoint s`;
        } catch (e) {
          await tx`rollback to savepoint s`;
          next.push(n);
          if (pass === 11) console.error(`${n}: ${(e as Error).message}`);
        }
      }
      pending = next;
    }
    if (pending.length) throw new Error(`could not clear: ${pending.join(', ')}; rolled back`);
    await tx`delete from tenants where id = any(${ids})`;
  });
  console.log(`deleted ${tenants.length} tenant(s).`);
} finally {
  await sql.end();
}
