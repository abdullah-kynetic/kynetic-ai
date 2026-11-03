-- DC-125: the super admin (Kynetic role admin) may start view-as without a typed reason, so `reason`
-- may be null. A reason that is stored must still be non-blank. The service requires one for a VA.
ALTER TABLE impersonation_sessions DROP CONSTRAINT impersonation_sessions_reason_check;
--> statement-breakpoint
ALTER TABLE impersonation_sessions
  ADD CONSTRAINT impersonation_sessions_reason_check
    CHECK (reason IS NULL OR length(btrim(reason)) > 0) NOT VALID;
