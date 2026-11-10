-- Client system requests, and the 30-day guarantee baseline.
-- The old guarantee_target_bookings column stays. The tracker no longer reads it.
-- system_requests: a client asks for a system that is off. No payment. One open request per system.

ALTER TABLE tenants
  ADD COLUMN guarantee_baseline_bookings integer
  CHECK (guarantee_baseline_bookings >= 0);
--> statement-breakpoint
COMMENT ON COLUMN tenants.guarantee_baseline_bookings IS
  'Admin override of last month booked appointments. NULL means count the 30 days before guarantee_start_date.';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION admin_update_tenant_commercial(p_tenant uuid, p_patch jsonb)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before jsonb;
  v_allowed text[] := ARRAY['plan','pricing_tier','status','avg_job_value_cents','baseline',
                            'guarantee_target_bookings','guarantee_baseline_bookings','guarantee_start_date',
                            'go_live_at','twenty_company_id'];
  v_key text;
BEGIN
  PERFORM rollup_require_role('admin');
  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'field % is not editable here', v_key USING ERRCODE = '22023';
    END IF;
  END LOOP;
  SELECT to_jsonb(t) INTO v_before FROM tenants t WHERE id = p_tenant;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE tenants SET
    plan = coalesce(p_patch->>'plan', plan),
    pricing_tier = CASE WHEN p_patch ? 'pricing_tier' THEN p_patch->>'pricing_tier' ELSE pricing_tier END,
    status = coalesce(p_patch->>'status', status),
    avg_job_value_cents = CASE WHEN p_patch ? 'avg_job_value_cents' THEN (p_patch->>'avg_job_value_cents')::int ELSE avg_job_value_cents END,
    baseline = coalesce(p_patch->'baseline', baseline),
    guarantee_target_bookings = CASE WHEN p_patch ? 'guarantee_target_bookings' THEN (p_patch->>'guarantee_target_bookings')::int ELSE guarantee_target_bookings END,
    guarantee_baseline_bookings = CASE WHEN p_patch ? 'guarantee_baseline_bookings' THEN (p_patch->>'guarantee_baseline_bookings')::int ELSE guarantee_baseline_bookings END,
    guarantee_start_date = CASE WHEN p_patch ? 'guarantee_start_date' THEN (p_patch->>'guarantee_start_date')::date ELSE guarantee_start_date END,
    go_live_at = CASE WHEN p_patch ? 'go_live_at' THEN (p_patch->>'go_live_at')::timestamptz ELSE go_live_at END,
    twenty_company_id = CASE WHEN p_patch ? 'twenty_company_id' THEN p_patch->>'twenty_company_id' ELSE twenty_company_id END,
    updated_at = now()
  WHERE id = p_tenant;
  PERFORM rollup_audit(p_tenant, 'tenant.commercial_update', 'tenant', p_tenant::text,
    (SELECT jsonb_object_agg(k, v_before->k) FROM jsonb_object_keys(p_patch) AS k), p_patch);
END $$;
--> statement-breakpoint
CREATE TABLE system_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  module_key text NOT NULL REFERENCES module_catalog(module_key),
  status text NOT NULL DEFAULT 'open' CHECK (status = 'open'),
  requested_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_key),
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX system_requests_tenant_idx ON system_requests (tenant_id, created_at DESC);
--> statement-breakpoint
SELECT app_enable_tenant_rls('system_requests'::regclass);
--> statement-breakpoint
REVOKE UPDATE, DELETE ON system_requests FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT ON system_requests TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION admin_list_system_requests() RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  module_key text,
  status text,
  created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY
    SELECT s.id, s.tenant_id, t.name, s.module_key, s.status, s.created_at
    FROM system_requests s JOIN tenants t ON t.id = s.tenant_id
    ORDER BY s.created_at DESC
    LIMIT 200;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_list_system_requests() OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION admin_list_system_requests() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_list_system_requests() TO kynetic_app;
