import postgres from 'postgres';
import { removeShopDemo } from './shop-demo';

const args = process.argv.slice(2);
const slugIndex = args.indexOf('--slug');
const slug = slugIndex >= 0 ? args[slugIndex + 1] : undefined;
const url = process.env.DATABASE_URL_SEED;
if (!url) throw new Error('DATABASE_URL_SEED is not set');
const sql = postgres(url, { max: 1 });
try {
  const result = await removeShopDemo(sql, { slug, apply: args.includes('--apply') });
  console.log(
    `${result.slug}: ${result.status}; rows=${result.rows}${result.status === 'planned' ? ' (dry run; pass --apply to delete)' : ''}`
  );
} finally {
  await sql.end();
}
