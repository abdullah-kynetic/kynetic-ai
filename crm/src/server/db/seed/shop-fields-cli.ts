import postgres from 'postgres';
import { ensureShopFields } from './shop-fields';

const args = process.argv.slice(2);
const slugIndex = args.indexOf('--slug');
const slug = slugIndex >= 0 ? args[slugIndex + 1] : undefined;
const url = process.env.DATABASE_URL_SEED;
if (!url) throw new Error('DATABASE_URL_SEED is not set');
const sql = postgres(url, { max: 1 });
try {
  const r = await ensureShopFields(sql, { slug, apply: args.includes('--apply') });
  console.log(
    `${r.slug}: ${r.status}; missing=[${r.missing.join(',')}]; existing=[${r.existing.join(',')}]${r.status === 'planned' ? ' (dry run; pass --apply to write)' : ''}`
  );
} finally {
  await sql.end();
}
