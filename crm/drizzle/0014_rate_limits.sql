-- M0-21: counters for the Postgres rate limiter (SECURITY 5.4). Global table, no tenant_id. Only the
-- runtime roles touch it; kynetic_auth has no grant. The key holds a hashed subject, never an IP or email.
CREATE TABLE rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key, window_start)
);
--> statement-breakpoint
CREATE INDEX rate_limits_expires_idx ON rate_limits (expires_at);
--> statement-breakpoint
REVOKE ALL ON rate_limits FROM kynetic_auth;
--> statement-breakpoint
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE rate_limits FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY runtime_all ON rate_limits FOR ALL TO kynetic_app, kynetic_worker USING (true) WITH CHECK (true);
