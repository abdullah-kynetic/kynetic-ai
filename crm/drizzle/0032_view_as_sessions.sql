-- M8a-04: view-as session state (F-57, SECURITY 2.6). Additive columns on impersonation_sessions, a
-- table owned by M0 whose only writer is the view-as service. The reason is mandatory at start; write
-- mode (admin only) carries its own reason and a hard expiry; last_seen_at drives the 30-minute idle
-- expiry. Rows are an audit trail, so the runtime roles lose DELETE and can only update the state columns.
ALTER TABLE impersonation_sessions
  ADD COLUMN reason text,
  ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN write_reason text,
  ADD COLUMN write_until timestamptz,
  ADD COLUMN ended_reason text;
--> statement-breakpoint
-- NOT VALID: rows written before this migration (none in practice) are not re-checked.
ALTER TABLE impersonation_sessions
  ADD CONSTRAINT impersonation_sessions_reason_check
    CHECK (reason IS NOT NULL AND length(btrim(reason)) > 0) NOT VALID,
  ADD CONSTRAINT impersonation_sessions_write_check
    CHECK (read_only OR (write_reason IS NOT NULL AND length(btrim(write_reason)) > 0 AND write_until IS NOT NULL));
--> statement-breakpoint
REVOKE DELETE, UPDATE ON impersonation_sessions FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT UPDATE (read_only, last_seen_at, write_reason, write_until, ended_at, ended_reason)
  ON impersonation_sessions TO kynetic_app;
