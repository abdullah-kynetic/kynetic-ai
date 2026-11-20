import type { TestDatabase } from '../helpers/db';
import { seedDemoClients } from '../../src/server/db/seed/demo-clients';
import postgres from 'postgres';

/** Seed only the isolated synthetic agency in the disposable browser database. */
export async function seedPhase3(db: TestDatabase) {
  const url = new URL(process.env.TEST_DATABASE_ADMIN_URL!);
  url.pathname = `/${db.name}`;
  const connection = postgres(url.toString(), { max: 1 });
  try {
    await seedDemoClients(connection, { only: 'demo-kynetic-agency', anchor: '2026-11-11' });
  } finally {
    await connection.end();
  }
}
