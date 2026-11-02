-- M16-01/M16-05: one isolated, synthetic-only agency workspace. No outbound/integration setup.
CREATE TABLE agency_workspaces (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
  workspace_key text NOT NULL UNIQUE CHECK (workspace_key = 'kynetic_synthetic'),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('agency_workspaces'::regclass);
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON agency_workspaces FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT, INSERT ON agency_workspaces TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION admin_agency_workspace(p_create boolean DEFAULT false)
RETURNS TABLE (tenant_id uuid, name text, slug text, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_tenant uuid; v_pipeline uuid;
BEGIN
  PERFORM rollup_require_role('admin');
  IF app_impersonator_id() IS NOT NULL OR app_read_only() OR NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = app_user_id() AND u.kynetic_role = 'admin' AND u.disabled_at IS NULL
  ) THEN RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kynetic-synthetic-agency-workspace', 0));
  SELECT w.tenant_id INTO v_tenant FROM agency_workspaces w WHERE w.workspace_key = 'kynetic_synthetic';
  IF v_tenant IS NOT NULL THEN
    RETURN QUERY SELECT t.id, t.name, t.slug, false FROM tenants t WHERE t.id = v_tenant;
    RETURN;
  END IF;
  IF NOT p_create THEN RETURN; END IF;
  INSERT INTO tenants (slug, name, plan, timezone)
    VALUES ('demo-kynetic-agency', 'Kynetic AI (synthetic)', 'founding', 'UTC') RETURNING id INTO v_tenant;
  INSERT INTO tenant_modules (tenant_id, module_key, enabled, config, changed_by)
    VALUES (v_tenant, 'platform', true, '{"outbound_kill_switch":true}', app_user_id());
  PERFORM set_tenant_module(v_tenant, 'crm', true, 'full');
  INSERT INTO alex_configs (tenant_id, provider, paused) VALUES (v_tenant, 'elevenlabs', true);
  INSERT INTO pipelines (tenant_id, name, is_default) VALUES (v_tenant, 'Agency sales', true) RETURNING id INTO v_pipeline;
  INSERT INTO pipeline_stages (tenant_id, pipeline_id, name, position, probability, is_won, is_lost)
    SELECT v_tenant, v_pipeline, s.name, s.position, s.probability, s.is_won, s.is_lost FROM (VALUES
      ('New',0,0,false,false), ('Contacted',1,0,false,false), ('Interested',2,0,false,false),
      ('Proposal Sent',3,0,false,false), ('Won',4,100,true,false), ('Lost',5,0,false,true), ('Nurture',6,0,false,false)
    ) AS s(name, position, probability, is_won, is_lost);
  INSERT INTO agency_workspaces (tenant_id, workspace_key) VALUES (v_tenant, 'kynetic_synthetic');
  PERFORM rollup_audit(v_tenant, 'agency.workspace.create', 'tenant', v_tenant::text, NULL,
    '{"synthetic":true,"outboundDisabled":true}');
  RETURN QUERY SELECT t.id, t.name, t.slug, true FROM tenants t WHERE t.id = v_tenant;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_agency_workspace(boolean) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION admin_agency_workspace(boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_agency_workspace(boolean) TO kynetic_app;
