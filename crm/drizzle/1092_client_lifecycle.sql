-- Design workspace only: client lifecycle cards. Apply to disposable dev/test databases.
CREATE TABLE client_lifecycle (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
  stage text NOT NULL CHECK (stage IN ('onboarding', 'live', 'at_risk', 'churned', 'demo')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE RESTRICT
);
--> statement-breakpoint
ALTER TABLE client_lifecycle ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE client_lifecycle FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON client_lifecycle FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON client_lifecycle TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION admin_client_lifecycle_list()
RETURNS TABLE (tenant_id uuid, stage text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF app_role() NOT IN ('admin', 'va') OR app_user_id() IS NULL THEN
    RAISE EXCEPTION 'staff only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT c.tenant_id, c.stage FROM client_lifecycle c;
END $$;
--> statement-breakpoint
ALTER FUNCTION admin_client_lifecycle_list() OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION admin_client_lifecycle_list() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_client_lifecycle_list() TO kynetic_app;
--> statement-breakpoint
CREATE FUNCTION admin_client_lifecycle_move(p_tenant uuid, p_stage text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE client_name text;
BEGIN
  IF app_role() <> 'admin' OR app_user_id() IS NULL OR app_read_only() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF p_stage NOT IN ('onboarding', 'live', 'at_risk', 'churned', 'demo') THEN
    RAISE EXCEPTION 'invalid lifecycle stage' USING ERRCODE = '22023';
  END IF;
  SELECT name INTO client_name FROM tenants WHERE id = p_tenant FOR UPDATE;
  IF client_name IS NULL THEN RAISE EXCEPTION 'client not found' USING ERRCODE = '02000'; END IF;
  IF client_name = 'Kynetic Restoration (Demo)' THEN
    RAISE EXCEPTION 'protected demo client' USING ERRCODE = '42501';
  END IF;
  INSERT INTO client_lifecycle (tenant_id, stage, updated_by)
    VALUES (p_tenant, p_stage, app_user_id())
    ON CONFLICT (tenant_id) DO UPDATE SET stage = excluded.stage, updated_by = excluded.updated_by, updated_at = now();
  RETURN p_stage;
END $$;
--> statement-breakpoint
ALTER FUNCTION admin_client_lifecycle_move(uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION admin_client_lifecycle_move(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_client_lifecycle_move(uuid, text) TO kynetic_app;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
