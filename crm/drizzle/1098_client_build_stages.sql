-- One stage model for a client: Building, Testing, Live (plus At risk, Churned, Demo).
-- The board stage is now the single control. Moving a client changes the tenant status and go-live time
-- with it, so the label, the "View as client" rule and the portal the owner sees can no longer disagree.
-- The old 'onboarding' stage becomes 'building'. The onboarding checklist stays as the internal task list
-- but no longer gates going live or forces steps to Done.
ALTER TABLE client_lifecycle DROP CONSTRAINT IF EXISTS client_lifecycle_stage_check;
--> statement-breakpoint
UPDATE client_lifecycle SET stage = 'building' WHERE stage = 'onboarding';
--> statement-breakpoint
ALTER TABLE client_lifecycle ADD CONSTRAINT client_lifecycle_stage_check
  CHECK (stage IN ('building', 'testing', 'live', 'at_risk', 'churned', 'demo', 'archived'));
--> statement-breakpoint
-- The systems being built for one client, and where each one is.
CREATE TABLE client_build_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  system_key text NOT NULL CHECK (length(system_key) BETWEEN 1 AND 60),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  outcome text CHECK (outcome IS NULL OR length(outcome) <= 500),
  stage text NOT NULL DEFAULT 'planned' CHECK (stage IN ('planned', 'building', 'testing', 'live')),
  note text CHECK (note IS NULL OR length(note) <= 500),
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, system_key)
);
--> statement-breakpoint
CREATE INDEX client_build_systems_tenant_idx ON client_build_systems (tenant_id, sort_order);
--> statement-breakpoint
SELECT app_enable_tenant_rls('client_build_systems'::regclass);
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON client_build_systems FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON client_build_systems TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION admin_list_build_systems(p_tenant uuid)
RETURNS TABLE (system_key text, name text, outcome text, stage text, note text, sort_order integer, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY SELECT b.system_key, b.name, b.outcome, b.stage, b.note, b.sort_order, b.updated_at
    FROM client_build_systems b WHERE b.tenant_id = p_tenant ORDER BY b.sort_order, b.name;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_save_build_system(
  p_tenant uuid, p_key text, p_name text, p_outcome text, p_stage text, p_note text, p_sort integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_before client_build_systems%ROWTYPE; v_after client_build_systems%ROWTYPE;
BEGIN
  PERFORM rollup_require_role('admin');
  IF app_read_only() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant) THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_stage NOT IN ('planned', 'building', 'testing', 'live') THEN
    RAISE EXCEPTION 'invalid system stage' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_before FROM client_build_systems WHERE tenant_id = p_tenant AND system_key = p_key;
  INSERT INTO client_build_systems (tenant_id, system_key, name, outcome, stage, note, sort_order)
    VALUES (p_tenant, p_key, btrim(p_name), NULLIF(btrim(p_outcome), ''), p_stage, NULLIF(btrim(p_note), ''), COALESCE(p_sort, 0))
    ON CONFLICT (tenant_id, system_key) DO UPDATE SET
      name = excluded.name, outcome = excluded.outcome, stage = excluded.stage,
      note = excluded.note, sort_order = excluded.sort_order, updated_at = now()
    RETURNING * INTO v_after;
  PERFORM rollup_audit(p_tenant, 'build_system.save', 'build_system', p_key,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE jsonb_build_object('stage', v_before.stage, 'note', v_before.note, 'name', v_before.name) END,
    jsonb_build_object('stage', v_after.stage, 'note', v_after.note, 'name', v_after.name));
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_remove_build_system(p_tenant uuid, p_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin');
  IF app_read_only() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  DELETE FROM client_build_systems WHERE tenant_id = p_tenant AND system_key = p_key;
  PERFORM rollup_audit(p_tenant, 'build_system.remove', 'build_system', p_key, NULL, NULL);
END $$;
--> statement-breakpoint
-- Archived is a sixth stage that hides a client and keeps its data; moving it back restores it.
-- Moving the stage now also moves the tenant: Building and Testing keep it in onboarding (View as client
-- allowed, owner sees the build portal); Live sets it active and stamps go_live_at once.
CREATE OR REPLACE FUNCTION admin_client_lifecycle_move(p_tenant uuid, p_stage text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE client_name text; v_status text;
BEGIN
  IF app_role() <> 'admin' OR app_user_id() IS NULL OR app_read_only() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF p_stage NOT IN ('building', 'testing', 'live', 'at_risk', 'churned', 'demo', 'archived') THEN
    RAISE EXCEPTION 'invalid lifecycle stage' USING ERRCODE = '22023';
  END IF;
  SELECT name, status INTO client_name, v_status FROM tenants WHERE id = p_tenant FOR UPDATE;
  IF client_name IS NULL THEN RAISE EXCEPTION 'client not found' USING ERRCODE = '02000'; END IF;
  IF client_name = 'Kynetic Restoration (Demo)' THEN
    RAISE EXCEPTION 'protected demo client' USING ERRCODE = '42501';
  END IF;
  -- Archived hides a client from the board, switcher and numbers without deleting anything. The AA Auto
  -- Body client (name, or the shop operations module) can never be archived.
  IF p_stage = 'archived' AND (
       client_name ILIKE '%AA Auto Body%'
       OR EXISTS (SELECT 1 FROM tenant_modules m WHERE m.tenant_id = p_tenant AND m.module_key = 'shop_ops' AND m.enabled)
     ) THEN
    RAISE EXCEPTION 'protected client' USING ERRCODE = '42501';
  END IF;
  IF v_status IN ('suspended', 'offboarded') AND p_stage IN ('building', 'testing', 'live') THEN
    RAISE EXCEPTION 'client is %', v_status USING ERRCODE = '55000';
  END IF;
  IF p_stage IN ('building', 'testing') THEN
    UPDATE tenants SET status = 'onboarding' WHERE id = p_tenant AND status = 'active';
  ELSIF p_stage = 'live' THEN
    UPDATE tenants SET status = 'active', go_live_at = COALESCE(go_live_at, now()) WHERE id = p_tenant;
    UPDATE onboarding_steps SET status = 'done', done_at = COALESCE(done_at, now())
      WHERE tenant_id = p_tenant AND step_key = 'go_live' AND status <> 'done';
  END IF;
  INSERT INTO client_lifecycle (tenant_id, stage, updated_by)
    VALUES (p_tenant, p_stage, app_user_id())
    ON CONFLICT (tenant_id) DO UPDATE SET stage = excluded.stage, updated_by = excluded.updated_by, updated_at = now();
  RETURN p_stage;
END $$;
--> statement-breakpoint
ALTER FUNCTION admin_list_build_systems(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_save_build_system(uuid, text, text, text, text, text, integer) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_remove_build_system(uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_client_lifecycle_move(uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION admin_list_build_systems(uuid), admin_save_build_system(uuid, text, text, text, text, text, integer), admin_remove_build_system(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_list_build_systems(uuid), admin_save_build_system(uuid, text, text, text, text, text, integer), admin_remove_build_system(uuid, text) TO kynetic_app;
