import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Run as kynetic_owner only (CI and deploy). The web app never runs migrations.
// This is the one place besides env.ts allowed to read process.env directly: it must not
// load the runtime env schema, which does not know DATABASE_URL_MIGRATE.
const url = process.env.DATABASE_URL_MIGRATE;
if (!url) {
  console.error('DATABASE_URL_MIGRATE is not set');
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
await sql.end();
console.log('migrations applied');
