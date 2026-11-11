import postgres from 'postgres';
import { seedDemoClients } from './demo-clients';

const args = process.argv.slice(2);
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
};
const url = process.env.DATABASE_URL_SEED;
if (!url) throw new Error('DATABASE_URL_SEED is not set');
const sql = postgres(url, { max: 1 });
try {
  const results = await seedDemoClients(sql, {
    dryRun: args.includes('--dry-run'),
    only: valueAfter('--only'),
    anchor: valueAfter('--anchor'),
    noAgency: args.includes('--no-agency')
  });
  for (const result of results)
    console.log(
      `${result.slug}: ${result.status}; rows=${result.inserted}; anchor=${result.anchor}${result.metrics ? `; dashboard=${JSON.stringify(result.metrics)}` : ''}`
    );
} finally {
  await sql.end();
}
