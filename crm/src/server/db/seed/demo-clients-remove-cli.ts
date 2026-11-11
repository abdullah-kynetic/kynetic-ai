import postgres from 'postgres';
import { removeDemoClients } from './demo-clients-remove';

const args = process.argv.slice(2),
  onlyIndex = args.indexOf('--only');
const only = onlyIndex < 0 ? undefined : args[onlyIndex + 1];
if (onlyIndex >= 0 && (!only || only.startsWith('--'))) throw new Error('--only requires a slug');
const url = process.env.DATABASE_URL_SEED;
if (!url) throw new Error('DATABASE_URL_SEED is not set');
const sql = postgres(url, { max: 1 });
try {
  const results = await removeDemoClients(sql, { only, dryRun: args.includes('--dry-run') });
  for (const result of results)
    console.log(`${result.slug}: ${result.status}; ledger_rows=${result.rows}`);
} finally {
  await sql.end();
}
