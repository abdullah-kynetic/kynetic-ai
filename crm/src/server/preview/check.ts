import postgres from 'postgres';
import { assertSyntheticOnly } from './guard';

// Preview start gate (compose `prepare` service). Like seed/index.ts this reads process.env
// directly so it does not load the runtime env schema. Exit 1 blocks the app and worker.
const url = process.env.DATABASE_URL_SEED;
if (!url) {
  console.error('DATABASE_URL_SEED is not set');
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
try {
  await assertSyntheticOnly(sql);
  console.log('preview database holds only seed tenants');
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
