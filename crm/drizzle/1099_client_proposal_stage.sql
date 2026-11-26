-- Proposal client stage: the client account is created and prepped while the deal is still being
-- proposed, before the contract is signed and the deposit is paid. The owner is not invited until then.
-- Proposal behaves like Building for the tenant (status onboarding, not live).
ALTER TABLE client_lifecycle DROP CONSTRAINT IF EXISTS client_lifecycle_stage_check;
--> statement-breakpoint
ALTER TABLE client_lifecycle ADD CONSTRAINT client_lifecycle_stage_check
  CHECK (stage IN ('proposal', 'building', 'testing', 'live', 'at_risk', 'churned', 'demo', 'archived'));
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION admin_client_lifecycle_move(p_tenant uuid, p_stage text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE client_name text; v_status text;
BEGIN
  IF app_role() <> 'admin' OR app_user_id() IS NULL OR app_read_only() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF p_stage NOT IN ('proposal', 'building', 'testing', 'live', 'at_risk', 'churned', 'demo', 'archived') THEN
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
  IF v_status IN ('suspended', 'offboarded') AND p_stage IN ('proposal', 'building', 'testing', 'live') THEN
    RAISE EXCEPTION 'client is %', v_status USING ERRCODE = '55000';
  END IF;
  IF p_stage IN ('proposal', 'building', 'testing') THEN
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
ALTER FUNCTION admin_client_lifecycle_move(uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
