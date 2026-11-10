-- Admin operations: global outbound pause, usage rollup, spend cap, offboarding export, staff alerts.
-- Writes go through SECURITY DEFINER functions. The env kill switch is not stored here and cannot be changed here.

CREATE TABLE platform_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  outbound_paused boolean NOT NULL DEFAULT false,
  paused_by uuid REFERENCES users(id),
  paused_at timestamptz,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(reason) <= 500),
  CHECK (NOT outbound_paused OR (reason IS NOT NULL AND char_length(btrim(reason)) > 0))
);
--> statement-breakpoint
INSERT INTO platform_settings (singleton) VALUES (true);
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON platform_settings FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE platform_settings FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY platform_settings_read ON platform_settings
  FOR SELECT TO kynetic_app, kynetic_worker
  USING (true);
--> statement-breakpoint
GRANT SELECT ON platform_settings TO kynetic_app, kynetic_worker, kynetic_rollup;
--> statement-breakpoint
GRANT UPDATE ON platform_settings TO kynetic_rollup;
--> statement-breakpoint
CREATE TABLE usage_daily (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  day date NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  call_seconds integer NOT NULL DEFAULT 0,
  call_cost_cents integer NOT NULL DEFAULT 0,
  sms_count integer NOT NULL DEFAULT 0,
  email_count integer NOT NULL DEFAULT 0,
  message_cost_cents integer NOT NULL DEFAULT 0,
  cost_unknown boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, day),
  CHECK (call_count >= 0 AND call_seconds >= 0 AND call_cost_cents >= 0),
  CHECK (sms_count >= 0 AND email_count >= 0 AND message_cost_cents >= 0)
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('usage_daily'::regclass);
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON usage_daily FROM kynetic_app;
--> statement-breakpoint
CREATE TABLE tenant_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  storage_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'ready', 'failed')),
  byte_size integer CHECK (byte_size IS NULL OR byte_size >= 0),
  error text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('tenant_exports'::regclass);
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON tenant_exports FROM kynetic_app;
--> statement-breakpoint
CREATE TABLE staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('job_failed', 'daily_digest', 'spend_cap')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text CHECK (body IS NULL OR char_length(body) <= 4000),
  link text CHECK (link IS NULL OR (char_length(link) <= 300 AND link LIKE '/%' AND link NOT LIKE '//%')),
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedupe_key)
);
--> statement-breakpoint
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE staff_notifications FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY staff_notifications_admin_read ON staff_notifications
  FOR SELECT TO kynetic_app
  USING (app_role() = 'admin' AND app_tenant_id() IS NULL);
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON staff_notifications FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT ON staff_notifications TO kynetic_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON staff_notifications TO kynetic_rollup;
--> statement-breakpoint
ALTER TABLE tenants
  ADD COLUMN monthly_spend_cap_cents integer CHECK (monthly_spend_cap_cents >= 0),
  ADD COLUMN offboarded_at timestamptz,
  ADD COLUMN deletion_due_on date,
  ADD COLUMN weekly_email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN report_email_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint
COMMENT ON COLUMN tenants.monthly_spend_cap_cents IS
  'Admin cap on month-to-date provider cost, in cents. NULL means no cap. Not a price.';
--> statement-breakpoint
COMMENT ON COLUMN tenants.deletion_due_on IS
  'Display only: offboarded_at plus 30 days. Nothing deletes the tenant automatically.';
--> statement-breakpoint
GRANT SELECT, UPDATE ON automations, automation_runs, service_tokens TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT ON usage_daily, support_requests, system_requests, contacts, calls, webhook_events, tenant_billing_modules TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, INSERT ON tenant_exports TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION admin_set_outbound_pause(p_paused boolean, p_reason text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before jsonb;
  v_reason text;
BEGIN
  PERFORM rollup_require_role('admin');
  IF app_read_only() THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  v_reason := NULLIF(btrim(coalesce(p_reason, '')), '');
  IF p_paused AND (v_reason IS NULL OR char_length(v_reason) > 500) THEN
    RAISE EXCEPTION 'pause reason required' USING ERRCODE = '22023';
  END IF;
  SELECT to_jsonb(s) INTO v_before FROM platform_settings s WHERE singleton;
  IF p_paused THEN
    UPDATE platform_settings SET
      outbound_paused = true,
      paused_by = app_user_id(),
      paused_at = now(),
      reason = v_reason,
      updated_at = now()
    WHERE singleton;
    PERFORM rollup_audit(NULL, 'platform.outbound_pause', 'platform_settings', 'singleton', v_before,
      jsonb_build_object('outbound_paused', true, 'reason', v_reason));
  ELSE
    UPDATE platform_settings SET
      outbound_paused = false,
      updated_at = now()
    WHERE singleton;
    PERFORM rollup_audit(NULL, 'platform.outbound_resume', 'platform_settings', 'singleton', v_before,
      jsonb_build_object('outbound_paused', false));
  END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_set_spend_cap(p_tenant uuid, p_cents integer)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before integer;
BEGIN
  PERFORM rollup_require_role('admin');
  IF app_read_only() THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  IF p_cents IS NOT NULL AND p_cents < 0 THEN
    RAISE EXCEPTION 'cap must be blank or zero or more' USING ERRCODE = '22023';
  END IF;
  SELECT monthly_spend_cap_cents INTO v_before FROM tenants WHERE id = p_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE tenants SET monthly_spend_cap_cents = p_cents, updated_at = now() WHERE id = p_tenant;
  PERFORM rollup_audit(p_tenant, 'tenant.spend_cap', 'tenant', p_tenant::text,
    jsonb_build_object('monthly_spend_cap_cents', v_before),
    jsonb_build_object('monthly_spend_cap_cents', p_cents));
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_set_client_emails(p_tenant uuid, p_weekly boolean, p_report boolean)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before jsonb;
BEGIN
  PERFORM rollup_require_role('admin');
  IF app_read_only() THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object('weekly_email_enabled', weekly_email_enabled, 'report_email_enabled', report_email_enabled)
    INTO v_before FROM tenants WHERE id = p_tenant;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE tenants SET
    weekly_email_enabled = p_weekly,
    report_email_enabled = p_report,
    updated_at = now()
  WHERE id = p_tenant;
  PERFORM rollup_audit(p_tenant, 'tenant.email_flags', 'tenant', p_tenant::text, v_before,
    jsonb_build_object('weekly_email_enabled', p_weekly, 'report_email_enabled', p_report));
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_offboard_tenant(p_tenant uuid, p_slug text)
  RETURNS TABLE (first_time boolean, export_id uuid, needs_enqueue boolean, offboarded_at timestamptz, deletion_due_on date)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_slug text;
  v_first boolean;
  v_off timestamptz;
  v_due date;
  v_export uuid;
  v_new boolean;
BEGIN
  PERFORM rollup_require_role('admin');
  IF app_read_only() THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  SELECT slug, tenants.offboarded_at, tenants.deletion_due_on
    INTO v_slug, v_off, v_due
  FROM tenants WHERE id = p_tenant FOR UPDATE;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_slug IS DISTINCT FROM p_slug THEN
    RAISE EXCEPTION 'slug does not match' USING ERRCODE = '22023';
  END IF;
  v_first := v_off IS NULL;
  UPDATE tenant_modules SET
    config = jsonb_set(coalesce(config, '{}'::jsonb), '{outbound_kill_switch}', 'true'::jsonb),
    changed_at = now(),
    changed_by = app_user_id()
  WHERE tenant_id = p_tenant AND module_key = 'platform';
  UPDATE automations SET enabled = false, updated_at = now() WHERE tenant_id = p_tenant AND enabled;
  UPDATE automation_runs SET
    status = 'stopped_module_off',
    stop_reason = 'tenant_offboard',
    updated_at = now()
  WHERE tenant_id = p_tenant AND status = 'active';
  UPDATE service_tokens SET revoked_at = now()
  WHERE tenant_id = p_tenant AND revoked_at IS NULL;
  IF v_first THEN
    v_off := now();
    v_due := (v_off AT TIME ZONE 'UTC')::date + 30;
    UPDATE tenants SET
      status = 'suspended',
      offboarded_at = v_off,
      deletion_due_on = v_due,
      updated_at = now()
    WHERE id = p_tenant;
    PERFORM rollup_audit(p_tenant, 'tenant.offboard', 'tenant', p_tenant::text, NULL,
      jsonb_build_object('status', 'suspended', 'offboarded_at', v_off, 'deletion_due_on', v_due));
  ELSE
    UPDATE tenants SET status = 'suspended', updated_at = now() WHERE id = p_tenant AND status <> 'suspended';
  END IF;
  SELECT e.id INTO v_export FROM tenant_exports e
  WHERE e.tenant_id = p_tenant AND e.status IN ('queued', 'ready')
  ORDER BY e.created_at DESC LIMIT 1;
  v_new := v_export IS NULL;
  IF v_new THEN
    v_export := gen_random_uuid();
    INSERT INTO tenant_exports (id, tenant_id, storage_key, status, created_by)
    VALUES (
      v_export,
      p_tenant,
      p_tenant::text || '/exports/' || v_export::text || '.zip',
      'queued',
      app_user_id()
    );
  END IF;
  first_time := v_first;
  export_id := v_export;
  needs_enqueue := v_new;
  offboarded_at := v_off;
  deletion_due_on := v_due;
  RETURN NEXT;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_usage_month(p_month date)
  RETURNS TABLE (
    tenant_id uuid,
    tenant_name text,
    call_count integer,
    call_seconds integer,
    call_cost_cents integer,
    sms_count integer,
    email_count integer,
    message_cost_cents integer,
    cost_unknown boolean,
    monthly_fee_cents integer,
    cap_cents integer
  ) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  IF p_month IS NULL OR extract(day FROM p_month) <> 1 THEN
    RAISE EXCEPTION 'month must be the first day' USING ERRCODE = '22023';
  END IF;
  PERFORM rollup_audit(NULL, 'usage.read', 'usage_daily', to_char(p_month, 'YYYY-MM'), NULL,
    jsonb_build_object('month', to_char(p_month, 'YYYY-MM')));
  RETURN QUERY
    SELECT
      t.id,
      t.name,
      coalesce(sum(u.call_count), 0)::int,
      coalesce(sum(u.call_seconds), 0)::int,
      coalesce(sum(u.call_cost_cents), 0)::int,
      coalesce(sum(u.sms_count), 0)::int,
      coalesce(sum(u.email_count), 0)::int,
      coalesce(sum(u.message_cost_cents), 0)::int,
      coalesce(bool_or(u.cost_unknown), false),
      (
        SELECT CASE WHEN count(*) = 0 THEN NULL
          ELSE coalesce(sum(m.monthly_cents * (100 - m.discount_pct) / 100), 0)::int END
        FROM tenant_billing_modules m
        WHERE m.tenant_id = t.id AND m.ended_at IS NULL
      ),
      t.monthly_spend_cap_cents
    FROM tenants t
    LEFT JOIN usage_daily u
      ON u.tenant_id = t.id AND u.day >= p_month AND u.day < (p_month + interval '1 month')::date
    GROUP BY t.id
    ORDER BY t.name;
END $$;
--> statement-breakpoint
CREATE FUNCTION note_spend_cap_reached(p_tenant uuid)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text;
  v_zone text;
  v_month text;
  v_key text;
  v_id uuid;
BEGIN
  IF app_tenant_id() IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  SELECT name, timezone INTO v_name, v_zone FROM tenants WHERE id = p_tenant;
  IF v_name IS NULL THEN RETURN false; END IF;
  v_month := to_char(now() AT TIME ZONE coalesce(v_zone, 'UTC'), 'YYYY-MM');
  v_key := 'spend-cap:' || p_tenant::text || ':' || v_month;
  INSERT INTO staff_notifications (kind, title, body, link, dedupe_key)
  VALUES (
    'spend_cap',
    'Spend cap reached',
    v_name || ' reached the monthly spend cap. New calls are blocked. The cap was not raised.',
    '/admin/usage',
    v_key
  )
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN false; END IF;
  PERFORM rollup_audit(p_tenant, 'tenant.spend_cap_reached', 'tenant', p_tenant::text, NULL,
    jsonb_build_object('month', v_month));
  RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION record_staff_notification(
  p_kind text, p_title text, p_body text, p_link text, p_dedupe_key text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_link text;
BEGIN
  IF session_user = 'kynetic_app' AND app_role() IS DISTINCT FROM 'admin' AND app_role() IS DISTINCT FROM 'system' THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('job_failed', 'daily_digest', 'spend_cap') THEN
    RAISE EXCEPTION 'unknown notification kind' USING ERRCODE = '22023';
  END IF;
  v_link := NULLIF(p_link, '');
  IF v_link IS NOT NULL AND (v_link NOT LIKE '/%' OR v_link LIKE '//%') THEN
    v_link := NULL;
  END IF;
  INSERT INTO staff_notifications (kind, title, body, link, dedupe_key)
  VALUES (p_kind, left(btrim(p_title), 200), left(p_body, 4000), v_link, NULLIF(p_dedupe_key, ''))
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION staff_digest_snapshot(p_since timestamptz)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF app_role() IS DISTINCT FROM 'system' AND app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'failed_webhooks', (
      SELECT count(*)::int FROM webhook_events w
      WHERE w.last_error IS NOT NULL AND w.received_at >= p_since
    ),
    'leads', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', s.name, 'count', s.n) ORDER BY s.name)
      FROM (
        SELECT t.name, count(c.id)::int AS n
        FROM tenants t
        JOIN contacts c ON c.tenant_id = t.id
        WHERE c.created_at >= p_since AND c.deleted_at IS NULL
        GROUP BY t.id, t.name
      ) s
    ), '[]'::jsonb),
    'flagged_calls', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', s.name, 'count', s.n) ORDER BY s.name)
      FROM (
        SELECT t.name, count(c.id)::int AS n
        FROM tenants t
        JOIN calls c ON c.tenant_id = t.id
        WHERE c.flagged AND c.flagged_by IS NULL
        GROUP BY t.id, t.name
      ) s
    ), '[]'::jsonb),
    'open_support', (
      SELECT count(*)::int FROM support_requests r WHERE r.status IN ('open', 'in_progress')
    ),
    'open_system_requests', (
      SELECT count(*)::int FROM system_requests r WHERE r.status = 'open'
    ),
    'spend_watch', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', s.name, 'percent', s.pct) ORDER BY s.name)
      FROM (
        SELECT t.name,
          CASE
            WHEN t.monthly_spend_cap_cents = 0 THEN 100
            ELSE least(999, (coalesce(sum(u.call_cost_cents + u.message_cost_cents), 0) * 100) / t.monthly_spend_cap_cents)
          END AS pct
        FROM tenants t
        LEFT JOIN usage_daily u ON u.tenant_id = t.id
          AND u.day >= (date_trunc('month', now() AT TIME ZONE t.timezone))::date
          AND u.day < (date_trunc('month', now() AT TIME ZONE t.timezone) + interval '1 month')::date
        WHERE t.monthly_spend_cap_cents IS NOT NULL
        GROUP BY t.id
      ) s
      WHERE s.pct >= 80
    ), '[]'::jsonb)
  );
END $$;
--> statement-breakpoint
CREATE FUNCTION staff_admin_emails()
  RETURNS TABLE (email text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF app_role() IS DISTINCT FROM 'system' AND app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.email FROM users u
    WHERE u.kynetic_role = 'admin' AND u.disabled_at IS NULL
    ORDER BY u.email;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_outbound_pause(boolean, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_spend_cap(uuid, integer) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_client_emails(uuid, boolean, boolean) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_offboard_tenant(uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_usage_month(date) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION note_spend_cap_reached(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION record_staff_notification(text, text, text, text, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION staff_digest_snapshot(timestamptz) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION staff_admin_emails() OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION
  admin_set_outbound_pause(boolean, text),
  admin_set_spend_cap(uuid, integer),
  admin_set_client_emails(uuid, boolean, boolean),
  admin_offboard_tenant(uuid, text),
  admin_usage_month(date),
  note_spend_cap_reached(uuid),
  record_staff_notification(text, text, text, text, text),
  staff_digest_snapshot(timestamptz),
  staff_admin_emails()
FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_set_outbound_pause(boolean, text),
  admin_set_spend_cap(uuid, integer),
  admin_set_client_emails(uuid, boolean, boolean),
  admin_offboard_tenant(uuid, text)
TO kynetic_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_usage_month(date) TO kynetic_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION note_spend_cap_reached(uuid),
  record_staff_notification(text, text, text, text, text),
  staff_digest_snapshot(timestamptz),
  staff_admin_emails()
TO kynetic_app, kynetic_worker;
