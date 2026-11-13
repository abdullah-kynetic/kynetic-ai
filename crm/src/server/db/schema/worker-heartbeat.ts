import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** One row per background process (today: `worker`). The worker upserts it; /api/health reads it. */
export const workerHeartbeats = pgTable('worker_heartbeats', {
  name: text().primaryKey(),
  beatAt: timestamp('beat_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  commitSha: text('commit_sha')
});
