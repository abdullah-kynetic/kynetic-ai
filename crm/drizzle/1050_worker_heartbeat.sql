-- P0-S4: the worker writes a heartbeat so /api/health can say whether it is alive. Global table, no
-- tenant_id, no personal data. beat_at is set by the database clock so a skewed container clock cannot
-- fake a live worker. Only the runtime roles touch it; kynetic_auth has no grant.
CREATE TABLE worker_heartbeats (
  name text PRIMARY KEY CHECK (length(btrim(name)) BETWEEN 1 AND 50),
  beat_at timestamptz NOT NULL DEFAULT now(),
  commit_sha text CHECK (commit_sha IS NULL OR length(commit_sha) <= 64)
);
--> statement-breakpoint
REVOKE ALL ON worker_heartbeats FROM kynetic_auth;
--> statement-breakpoint
ALTER TABLE worker_heartbeats ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE worker_heartbeats FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY runtime_read ON worker_heartbeats FOR SELECT TO kynetic_app, kynetic_worker USING (true);
--> statement-breakpoint
CREATE POLICY worker_write ON worker_heartbeats FOR ALL TO kynetic_worker USING (true) WITH CHECK (true);
