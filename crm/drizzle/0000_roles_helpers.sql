-- M0-04: extensions, schema privileges, session-variable helpers, app_enable_tenant_rls.
-- Runs as kynetic_owner. Roles are created beforehand by deploy/db/bootstrap.sql.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('kynetic_owner', false), ('kynetic_rollup', true), ('kynetic_app', false), ('kynetic_worker', false)
    ) AS t(name, bypass)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.name) THEN
      RAISE EXCEPTION 'role % is missing; run deploy/db/bootstrap.sql first', r.name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('kynetic_app','kynetic_worker') AND (rolbypassrls OR rolsuper)) THEN
    RAISE EXCEPTION 'kynetic_app and kynetic_worker must not have BYPASSRLS or SUPERUSER';
  END IF;
  IF current_user <> 'kynetic_owner' THEN
    RAISE EXCEPTION 'migrations must run as kynetic_owner, not %', current_user;
  END IF;
END $$;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO kynetic_app, kynetic_worker, kynetic_rollup;
--> statement-breakpoint
-- Runtime roles get table and sequence privileges by default; RLS narrows rows and later
-- migrations REVOKE where a role must never write (DATABASE.md RLS section).
ALTER DEFAULT PRIVILEGES FOR ROLE kynetic_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kynetic_app, kynetic_worker;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kynetic_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kynetic_app, kynetic_worker;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.role', true), '') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_impersonator_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.impersonator_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_read_only() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.read_only', true), 'off') = 'on' $$;
--> statement-breakpoint
-- Standard tenant policies for table t (which must have tenant_id). No staff clause (SECURITY 2.3).
-- Policies apply to kynetic_app and kynetic_worker; the worker sets tenant context per job.
CREATE OR REPLACE FUNCTION app_enable_tenant_rls(t regclass) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t);
  EXECUTE format($p$CREATE POLICY tenant_select ON %1$s FOR SELECT TO kynetic_app, kynetic_worker
    USING (tenant_id = app_tenant_id())$p$, t);
  EXECUTE format($p$CREATE POLICY tenant_insert ON %1$s FOR INSERT TO kynetic_app, kynetic_worker
    WITH CHECK (tenant_id = app_tenant_id() AND NOT app_read_only())$p$, t);
  EXECUTE format($p$CREATE POLICY tenant_update ON %1$s FOR UPDATE TO kynetic_app, kynetic_worker
    USING (tenant_id = app_tenant_id() AND NOT app_read_only())
    WITH CHECK (tenant_id = app_tenant_id() AND NOT app_read_only())$p$, t);
  EXECUTE format($p$CREATE POLICY tenant_delete ON %1$s FOR DELETE TO kynetic_app, kynetic_worker
    USING (tenant_id = app_tenant_id() AND NOT app_read_only())$p$, t);
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_enable_tenant_rls(regclass) FROM PUBLIC;
