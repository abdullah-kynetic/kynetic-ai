import postgres from 'postgres';
import { importArchive } from './import';

// Loads the roadmap archive. DATABASE_URL_SEED must bypass row-level security.
// Usage: bun run db:import:archive <path to docs/roadmap>
const url = process.env.DATABASE_URL_SEED;
const dir = process.argv[2];
if (!url || !dir) {
  console.error('Set DATABASE_URL_SEED and pass the roadmap folder: db:import:archive <dir>');
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
const result = await importArchive(sql, dir);
await sql.end();
console.log(JSON.stringify(result));
