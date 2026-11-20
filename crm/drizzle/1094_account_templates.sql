-- Account templates (GoHighLevel-style snapshots). A template is a saved copy of one client's setup:
-- modules, pipelines and stages, custom fields, tags, automations (always saved switched off) and the
-- Alex call settings. It never holds contacts, deals, calls, messages, secrets, phone numbers or tokens.
-- Agency-level: no tenant_id, so no client can reach a row. Admin and VA sessions with no client
-- context can read; only an admin session that is not read-only can write.
CREATE TABLE account_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  source_tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX account_templates_name_uq ON account_templates (lower(name)) WHERE archived_at IS NULL;
--> statement-breakpoint
ALTER TABLE account_templates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE account_templates FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY account_templates_staff_read ON account_templates FOR SELECT TO kynetic_app
  USING (app_role() IN ('admin', 'va') AND app_tenant_id() IS NULL);
--> statement-breakpoint
CREATE POLICY account_templates_admin_insert ON account_templates FOR INSERT TO kynetic_app
  WITH CHECK (app_role() = 'admin' AND app_tenant_id() IS NULL AND NOT app_read_only());
--> statement-breakpoint
CREATE POLICY account_templates_admin_update ON account_templates FOR UPDATE TO kynetic_app
  USING (app_role() = 'admin' AND app_tenant_id() IS NULL AND NOT app_read_only())
  WITH CHECK (app_role() = 'admin' AND app_tenant_id() IS NULL AND NOT app_read_only());
--> statement-breakpoint
REVOKE ALL ON account_templates FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT, INSERT ON account_templates TO kynetic_app;
--> statement-breakpoint
GRANT UPDATE (name, description, updated_at, archived_at) ON account_templates TO kynetic_app;
