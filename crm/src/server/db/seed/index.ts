import postgres from 'postgres';
import { seedDemoTenants } from './demo';

// Dev, test and preview only. Tenant tables force row-level security, so DATABASE_URL_SEED must
// name a role that bypasses it (a superuser or BYPASSRLS role), never the app or worker role.
// Like migrate.ts this reads process.env directly so it does not load the runtime env schema.
const url = process.env.DATABASE_URL_SEED;
if (!url) {
  console.error('DATABASE_URL_SEED is not set');
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
const results = await seedDemoTenants(sql);
await sql.end();
for (const r of results) console.log(`${r.slug}: ${r.status}`);
