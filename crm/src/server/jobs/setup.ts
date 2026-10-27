import { PgBoss } from 'pg-boss';
import postgres from 'postgres';
import { JOBS_SCHEMA, QUEUES, type QueueName } from './queues';

/**
 * Installs or upgrades the pg-boss schema, creates every declared queue, and lets the runtime roles
 * use them. Run as kynetic_owner, from the migrate script (CI and deploy). Idempotent.
 */
export async function setupJobs(
  ownerUrl: string,
  extraQueues: Record<string, Omit<import('pg-boss').Queue, 'name'>> = {}
): Promise<void> {
  const boss = new PgBoss({
    connectionString: ownerUrl,
    schema: JOBS_SCHEMA,
    max: 2,
    supervise: false,
    schedule: false,
    registerInstance: false
  });
  boss.on('error', () => undefined);
  await boss.start();
  try {
    const all: Record<string, Omit<import('pg-boss').Queue, 'name'>> = {
      ...QUEUES,
      ...extraQueues
    };
    for (const [name, opts] of Object.entries(all)) {
      if (!(await boss.getQueue(name))) await boss.createQueue(name, opts);
    }
  } finally {
    await boss.stop({ graceful: true, close: true });
  }

  const sql = postgres(ownerUrl, { max: 1 });
  try {
    await sql.unsafe(`
      GRANT USAGE ON SCHEMA ${JOBS_SCHEMA} TO kynetic_app, kynetic_worker;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${JOBS_SCHEMA} TO kynetic_app, kynetic_worker;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${JOBS_SCHEMA} TO kynetic_app, kynetic_worker;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${JOBS_SCHEMA} TO kynetic_app, kynetic_worker;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${JOBS_SCHEMA}
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kynetic_app, kynetic_worker;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${JOBS_SCHEMA}
        GRANT USAGE, SELECT ON SEQUENCES TO kynetic_app, kynetic_worker;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${JOBS_SCHEMA}
        GRANT EXECUTE ON FUNCTIONS TO kynetic_app, kynetic_worker;
    `);
  } finally {
    await sql.end();
  }
}

export type { QueueName };
