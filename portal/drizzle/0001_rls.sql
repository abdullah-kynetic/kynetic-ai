-- Row-level security: second isolation layer behind the app's explicit client_id filters.
-- Context is set per transaction by src/lib/db/scoped.ts via set_config(..., true).
-- Unset context => role '' => no policy matches => zero rows.
CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.role', true), '')
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_client_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.client_id', true), '')::uuid
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','business_profiles','contacts','scope_items','milestones','documents',
                           'daily_results','ingest_keys','users','auth_tokens','rate_limits','audit_log']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY admin_all ON %I FOR ALL USING (app_role() = ''admin'') WITH CHECK (app_role() = ''admin'')', t);
  END LOOP;
  -- Tenant tables: a client may read only its own rows.
  FOREACH t IN ARRAY ARRAY['business_profiles','contacts','scope_items','milestones','documents','daily_results']
  LOOP
    EXECUTE format('CREATE POLICY client_read ON %I FOR SELECT USING (app_role() = ''client'' AND client_id = app_client_id())', t);
  END LOOP;
END $$;--> statement-breakpoint
CREATE POLICY client_read ON clients FOR SELECT USING (app_role() = 'client' AND id = app_client_id());--> statement-breakpoint
-- Clients may upload documents to their own tenant only.
CREATE POLICY client_insert ON documents FOR INSERT
  WITH CHECK (app_role() = 'client' AND client_id = app_client_id() AND uploaded_by_role = 'client' AND uploaded_by = app_user_id());--> statement-breakpoint
-- Users: a client sees/updates only its own row; system scope is used by auth before a session exists.
CREATE POLICY client_self_read ON users FOR SELECT USING (app_role() = 'client' AND id = app_user_id() AND client_id = app_client_id());--> statement-breakpoint
CREATE POLICY client_self_update ON users FOR UPDATE
  USING (app_role() = 'client' AND id = app_user_id())
  WITH CHECK (app_role() = 'client' AND id = app_user_id() AND client_id = app_client_id() AND role = 'client');--> statement-breakpoint
CREATE POLICY system_all ON users FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');--> statement-breakpoint
CREATE POLICY system_all ON auth_tokens FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');--> statement-breakpoint
CREATE POLICY system_all ON rate_limits FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');--> statement-breakpoint
CREATE POLICY system_all ON ingest_keys FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');--> statement-breakpoint
-- Ingest scope: an authenticated ingest key may write results for its own client only.
CREATE POLICY ingest_write ON daily_results FOR ALL
  USING (app_role() = 'ingest' AND client_id = app_client_id())
  WITH CHECK (app_role() = 'ingest' AND client_id = app_client_id());--> statement-breakpoint
CREATE POLICY ingest_client_read ON clients FOR SELECT USING (app_role() = 'ingest' AND id = app_client_id());--> statement-breakpoint
CREATE POLICY audit_insert ON audit_log FOR INSERT WITH CHECK (
  app_role() = 'system' OR (app_role() IN ('client','ingest') AND client_id = app_client_id())
);--> statement-breakpoint
-- Runtime role: no ownership, no BYPASSRLS. Created by deploy/bootstrap (or tests) before migrations run.
GRANT USAGE ON SCHEMA public TO portal_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portal_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_role(), app_client_id(), app_user_id() TO portal_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_app;
