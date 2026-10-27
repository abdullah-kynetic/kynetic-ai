-- M8a-08: onboarding checklist access (F-100, SECURITY 2.2 and the F-100 line in the access notes).
-- Owners and staff read only `client_visible` steps and never write; Kynetic staff work the checklist through three
-- roll-up functions (no RLS policy names a staff role). Go-live is admin only and needs every other step done or n/a.
CREATE POLICY client_visible_only ON onboarding_steps AS RESTRICTIVE FOR SELECT TO kynetic_app, kynetic_worker
  USING (client_visible OR app_role() NOT IN ('owner', 'staff'));
--> statement-breakpoint
CREATE POLICY no_client_insert ON onboarding_steps AS RESTRICTIVE FOR INSERT TO kynetic_app, kynetic_worker
  WITH CHECK (app_role() NOT IN ('owner', 'staff'));
--> statement-breakpoint
CREATE POLICY no_client_update ON onboarding_steps AS RESTRICTIVE FOR UPDATE TO kynetic_app, kynetic_worker
  USING (app_role() NOT IN ('owner', 'staff')) WITH CHECK (app_role() NOT IN ('owner', 'staff'));
--> statement-breakpoint
CREATE POLICY no_client_delete ON onboarding_steps AS RESTRICTIVE FOR DELETE TO kynetic_app, kynetic_worker
  USING (app_role() NOT IN ('owner', 'staff'));
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION admin_list_onboarding_steps(p_tenant uuid)
  RETURNS TABLE (step_key text, title text, module_key text, client_visible boolean, status text,
                 owner_user_id uuid, owner_name text, due_date date, done_at timestamptz, note text,
                 go_live_at timestamptz)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  IF NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = p_tenant) THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
    SELECT s.step_key, s.title, s.module_key, s.client_visible, s.status, s.owner_user_id, u.name,
           s.due_date, s.done_at, s.note, t.go_live_at
      FROM onboarding_steps s
      JOIN tenants t ON t.id = s.tenant_id
      LEFT JOIN users u ON u.id = s.owner_user_id
     WHERE s.tenant_id = p_tenant;
END $$;
--> statement-breakpoint
-- p_patch may carry status, owner_user_id, due_date and note. `go_live` changes only through mark_tenant_go_live.
CREATE FUNCTION update_onboarding_step(p_tenant uuid, p_step_key text, p_patch jsonb) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before onboarding_steps%ROWTYPE;
  v_after onboarding_steps%ROWTYPE;
  v_status text;
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  IF p_step_key = 'go_live' THEN
    RAISE EXCEPTION 'go-live changes only through mark_tenant_go_live' USING ERRCODE = '22023';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('status', 'owner_user_id', 'due_date', 'note')) THEN
    RAISE EXCEPTION 'patch must be a non-empty object of status, owner_user_id, due_date, note' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_before FROM onboarding_steps WHERE tenant_id = p_tenant AND step_key = p_step_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'step not found' USING ERRCODE = 'P0002';
  END IF;
  v_status := CASE WHEN p_patch ? 'status' THEN p_patch->>'status' ELSE v_before.status END;
  IF v_status NOT IN ('todo', 'doing', 'blocked', 'done', 'n/a') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF p_patch ? 'note' AND length(p_patch->>'note') > 2000 THEN
    RAISE EXCEPTION 'note too long' USING ERRCODE = '22023';
  END IF;
  UPDATE onboarding_steps SET
      status = v_status,
      done_at = CASE WHEN v_status = 'done' THEN COALESCE(v_before.done_at, now()) ELSE NULL END,
      owner_user_id = CASE WHEN p_patch ? 'owner_user_id' THEN (p_patch->>'owner_user_id')::uuid ELSE owner_user_id END,
      due_date = CASE WHEN p_patch ? 'due_date' THEN (p_patch->>'due_date')::date ELSE due_date END,
      note = CASE WHEN p_patch ? 'note' THEN NULLIF(btrim(p_patch->>'note'), '') ELSE note END
   WHERE tenant_id = p_tenant AND step_key = p_step_key
   RETURNING * INTO v_after;
  PERFORM rollup_audit(p_tenant, 'onboarding_step.update', 'onboarding_step', p_step_key,
    jsonb_build_object('status', v_before.status, 'owner_user_id', v_before.owner_user_id,
                       'due_date', v_before.due_date, 'note', v_before.note),
    jsonb_build_object('status', v_after.status, 'owner_user_id', v_after.owner_user_id,
                       'due_date', v_after.due_date, 'note', v_after.note));
END $$;
--> statement-breakpoint
-- Raises 55000 when the tenant is already live and 23514 when a step other than go_live is still open.
CREATE FUNCTION mark_tenant_go_live(p_tenant uuid) RETURNS timestamptz
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_status text;
  v_live timestamptz;
  v_open integer;
  v_at timestamptz := now();
BEGIN
  PERFORM rollup_require_role('admin');
  SELECT status, go_live_at INTO v_status, v_live FROM tenants WHERE id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_live IS NOT NULL THEN
    RAISE EXCEPTION 'tenant is already live' USING ERRCODE = '55000';
  END IF;
  SELECT count(*) INTO v_open FROM onboarding_steps
   WHERE tenant_id = p_tenant AND step_key <> 'go_live' AND status NOT IN ('done', 'n/a');
  IF v_open > 0 THEN
    RAISE EXCEPTION '% checklist steps are not done', v_open USING ERRCODE = '23514';
  END IF;
  UPDATE tenants SET go_live_at = v_at, status = CASE WHEN status = 'onboarding' THEN 'active' ELSE status END
   WHERE id = p_tenant;
  UPDATE onboarding_steps SET status = 'done', done_at = v_at WHERE tenant_id = p_tenant AND step_key = 'go_live';
  PERFORM rollup_audit(p_tenant, 'tenant.go_live', 'tenant', p_tenant::text,
    jsonb_build_object('status', v_status, 'go_live_at', NULL),
    jsonb_build_object('status', CASE WHEN v_status = 'onboarding' THEN 'active' ELSE v_status END, 'go_live_at', v_at));
  RETURN v_at;
END $$;
--> statement-breakpoint
ALTER FUNCTION admin_list_onboarding_steps(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION update_onboarding_step(uuid, text, jsonb) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION mark_tenant_go_live(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION admin_list_onboarding_steps(uuid), update_onboarding_step(uuid, text, jsonb), mark_tenant_go_live(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_list_onboarding_steps(uuid), update_onboarding_step(uuid, text, jsonb), mark_tenant_go_live(uuid) TO kynetic_app;
