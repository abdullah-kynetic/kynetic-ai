-- M0-09: SECURITY DEFINER roll-up functions owned by the NOLOGIN, BYPASSRLS role kynetic_rollup
-- (SECURITY 2.3.6, DATABASE.md "SECURITY DEFINER functions"). Each function checks app_role() first
-- and raises 42501 otherwise, and writes an audit_log row in the same transaction. No RLS policy
-- names a staff role; this is the only cross-tenant path.

-- Table privileges the roll-up role needs. It is NOLOGIN, so these are reachable only through the
-- functions below.
GRANT USAGE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON tenants, tenant_modules TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, UPDATE ON users TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT ON memberships, contacts, calls, appointments, integrations TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, INSERT ON pipelines TO kynetic_rollup;
--> statement-breakpoint
GRANT INSERT ON invitations, pipeline_stages, alex_configs TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_log TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
-- Internal helpers: not executable by the web or worker roles.
CREATE FUNCTION rollup_require_role(VARIADIC p_roles text[]) RETURNS void
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF app_role() IS NULL OR NOT (app_role() = ANY (p_roles)) THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION rollup_audit(p_tenant uuid, p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO audit_log (tenant_id, actor_user_id, impersonator_user_id, action, entity, entity_id, before, after)
  VALUES (p_tenant, app_user_id(), app_impersonator_id(), p_action, p_entity, p_entity_id, p_before, p_after) $$;
--> statement-breakpoint
CREATE FUNCTION create_tenant(
  p_slug text, p_name text, p_plan text, p_timezone text, p_owner_email text,
  p_invite_token_hash text, p_invite_expires_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_pipeline uuid;
BEGIN
  PERFORM rollup_require_role('admin');
  INSERT INTO tenants (slug, name, plan, timezone) VALUES (p_slug, p_name, p_plan, p_timezone) RETURNING id INTO v_id;
  -- Later statements in this transaction run in the new tenant's context (F-55).
  PERFORM set_config('app.tenant_id', v_id::text, true);
  INSERT INTO tenant_modules (tenant_id, module_key, enabled, changed_by)
    VALUES (v_id, 'platform', true, app_user_id());
  INSERT INTO invitations (tenant_id, email, role, token_hash, invited_by, expires_at)
    VALUES (v_id, lower(p_owner_email), 'owner', p_invite_token_hash, app_user_id(), p_invite_expires_at);
  INSERT INTO pipelines (tenant_id, name, is_default) VALUES (v_id, 'Sales', true) RETURNING id INTO v_pipeline;
  INSERT INTO pipeline_stages (tenant_id, pipeline_id, name, position, probability, is_won, is_lost)
  SELECT v_id, v_pipeline, s.name, s.position, s.probability, s.is_won, s.is_lost FROM (VALUES
    ('New', 0, 5, false, false), ('Contacted', 1, 15, false, false), ('Qualified', 2, 30, false, false),
    ('Estimate Booked', 3, 45, false, false), ('Estimate Done', 4, 60, false, false),
    ('Quoted', 5, 70, false, false), ('Won', 6, 100, true, false), ('Lost', 7, 0, false, true)
  ) AS s(name, position, probability, is_won, is_lost);
  INSERT INTO alex_configs (tenant_id, provider, paused) VALUES (v_id, 'elevenlabs', true);
  PERFORM rollup_audit(v_id, 'tenant.create', 'tenant', v_id::text, NULL,
    jsonb_build_object('slug', p_slug, 'name', p_name, 'plan', p_plan));
  RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION set_tenant_module(p_tenant uuid, p_module text, p_enabled boolean, p_level text DEFAULT '')
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before jsonb;
BEGIN
  PERFORM rollup_require_role('admin');
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant) THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT to_jsonb(m) - 'config' INTO v_before FROM tenant_modules m WHERE tenant_id = p_tenant AND module_key = p_module;
  INSERT INTO tenant_modules (tenant_id, module_key, enabled, level, changed_by, changed_at)
    VALUES (p_tenant, p_module, p_enabled, coalesce(p_level, ''), app_user_id(), now())
  ON CONFLICT (tenant_id, module_key) DO UPDATE
    SET enabled = EXCLUDED.enabled, level = EXCLUDED.level, changed_by = EXCLUDED.changed_by, changed_at = EXCLUDED.changed_at;
  PERFORM rollup_audit(p_tenant, 'module.toggle', 'tenant_module', p_module, v_before,
    jsonb_build_object('module_key', p_module, 'enabled', p_enabled, 'level', coalesce(p_level, '')));
END $$;
--> statement-breakpoint
-- Fields only an admin may change on a tenant (plan, tier, status, baseline, guarantee).
CREATE FUNCTION admin_update_tenant_commercial(p_tenant uuid, p_patch jsonb)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before jsonb;
  v_allowed text[] := ARRAY['plan','pricing_tier','status','avg_job_value_cents','baseline',
                            'guarantee_target_bookings','guarantee_start_date','go_live_at','twenty_company_id'];
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
    guarantee_start_date = CASE WHEN p_patch ? 'guarantee_start_date' THEN (p_patch->>'guarantee_start_date')::date ELSE guarantee_start_date END,
    go_live_at = CASE WHEN p_patch ? 'go_live_at' THEN (p_patch->>'go_live_at')::timestamptz ELSE go_live_at END,
    twenty_company_id = CASE WHEN p_patch ? 'twenty_company_id' THEN p_patch->>'twenty_company_id' ELSE twenty_company_id END,
    updated_at = now()
  WHERE id = p_tenant;
  PERFORM rollup_audit(p_tenant, 'tenant.commercial_update', 'tenant', p_tenant::text,
    (SELECT jsonb_object_agg(k, v_before->k) FROM jsonb_object_keys(p_patch) AS k), p_patch);
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_set_kynetic_role(p_user uuid, p_role text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before text;
BEGIN
  PERFORM rollup_require_role('admin');
  IF p_role IS NOT NULL AND p_role NOT IN ('admin','va') THEN
    RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
  END IF;
  SELECT kynetic_role INTO v_before FROM users WHERE id = p_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE users SET kynetic_role = p_role, updated_at = now() WHERE id = p_user;
  PERFORM rollup_audit(NULL, 'user.kynetic_role', 'user', p_user::text,
    jsonb_build_object('kynetic_role', v_before), jsonb_build_object('kynetic_role', p_role));
END $$;
--> statement-breakpoint
-- One row per tenant, aggregates only: no names, emails, phone numbers or message text.
CREATE FUNCTION admin_tenant_overview() RETURNS TABLE (
  tenant_id uuid, slug text, name text, plan text, status text, pricing_tier text,
  leads_30d integer, calls_30d integer, appointments_30d integer, booking_rate numeric,
  guarantee_target_bookings integer, guarantee_bookings integer, guarantee_start_date date,
  integration_errors integer, last_login_at timestamptz, go_live_at timestamptz, modules_enabled text[]
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY
  SELECT t.id, t.slug, t.name, t.plan, t.status, t.pricing_tier,
    (SELECT count(*)::int FROM contacts c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL AND c.created_at >= now() - interval '30 days'),
    (SELECT count(*)::int FROM calls c WHERE c.tenant_id = t.id AND c.started_at >= now() - interval '30 days'),
    (SELECT count(*)::int FROM appointments a WHERE a.tenant_id = t.id AND a.created_at >= now() - interval '30 days' AND a.status <> 'cancelled'),
    CASE WHEN (SELECT count(*) FROM contacts c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL AND c.created_at >= now() - interval '30 days') = 0 THEN NULL
         ELSE round((SELECT count(*) FROM appointments a WHERE a.tenant_id = t.id AND a.created_at >= now() - interval '30 days' AND a.status <> 'cancelled')::numeric
              / (SELECT count(*) FROM contacts c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL AND c.created_at >= now() - interval '30 days'), 4) END,
    t.guarantee_target_bookings,
    CASE WHEN t.guarantee_start_date IS NULL THEN NULL
         ELSE (SELECT count(*)::int FROM appointments a WHERE a.tenant_id = t.id AND a.status <> 'cancelled' AND a.created_at >= t.guarantee_start_date) END,
    t.guarantee_start_date,
    coalesce((SELECT sum(i.error_count)::int FROM integrations i WHERE i.tenant_id = t.id), 0),
    (SELECT max(u.last_login_at) FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = t.id),
    t.go_live_at,
    coalesce((SELECT array_agg(m.module_key ORDER BY m.module_key) FROM tenant_modules m WHERE m.tenant_id = t.id AND m.enabled), '{}')
  FROM tenants t ORDER BY t.name;
END $$;
--> statement-breakpoint
CREATE FUNCTION audit_search(p_tenant uuid DEFAULT NULL, p_actor uuid DEFAULT NULL, p_action text DEFAULT NULL,
                             p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_limit integer DEFAULT 200)
  RETURNS SETOF audit_log LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY
  SELECT * FROM audit_log a
  WHERE (p_tenant IS NULL OR a.tenant_id = p_tenant)
    AND (p_actor IS NULL OR a.actor_user_id = p_actor)
    AND (p_action IS NULL OR a.action = p_action)
    AND (p_from IS NULL OR a.created_at >= p_from)
    AND (p_to IS NULL OR a.created_at < p_to)
  ORDER BY a.created_at DESC
  LIMIT least(greatest(p_limit, 1), 1000);
END $$;
--> statement-breakpoint
-- Hand ownership to the roll-up role (it is the BYPASSRLS role), then close the schema again.
ALTER FUNCTION rollup_require_role(text[]) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION rollup_audit(uuid, text, text, text, jsonb, jsonb) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION create_tenant(text, text, text, text, text, text, timestamptz) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION set_tenant_module(uuid, text, boolean, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_update_tenant_commercial(uuid, jsonb) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_kynetic_role(uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_tenant_overview() OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION audit_search(uuid, uuid, text, timestamptz, timestamptz, integer) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION rollup_require_role(text[]), rollup_audit(uuid, text, text, text, jsonb, jsonb),
  create_tenant(text, text, text, text, text, text, timestamptz), set_tenant_module(uuid, text, boolean, text),
  admin_update_tenant_commercial(uuid, jsonb), admin_set_kynetic_role(uuid, text), admin_tenant_overview(),
  audit_search(uuid, uuid, text, timestamptz, timestamptz, integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION create_tenant(text, text, text, text, text, text, timestamptz),
  set_tenant_module(uuid, text, boolean, text), admin_update_tenant_commercial(uuid, jsonb),
  admin_set_kynetic_role(uuid, text), admin_tenant_overview(),
  audit_search(uuid, uuid, text, timestamptz, timestamptz, integer) TO kynetic_app;
