import postgres from 'postgres';
import { seedProspectTenants } from './prospects';

// Loads the 13 real-business workspaces. DATABASE_URL_SEED must bypass row-level security.
const url = process.env.DATABASE_URL_SEED;
if (!url) {
  console.error('DATABASE_URL_SEED is not set');
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
const results = await seedProspectTenants(sql);
await sql.end();
for (const r of results) console.log(`${r.slug}: ${r.status}`);
