-- M0-08 hardening (DC-053): the runtime roles may append audit rows only for the tenant in context,
-- or with no tenant (sign-in and platform events). Before this, WITH CHECK (true) let a session
-- write an audit row naming another tenant.
DROP POLICY audit_insert ON audit_log;
--> statement-breakpoint
CREATE POLICY audit_insert ON audit_log FOR INSERT TO kynetic_app, kynetic_worker
  WITH CHECK (tenant_id IS NULL OR tenant_id = app_tenant_id());
