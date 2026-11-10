-- Per-tenant schedule settings and retention helpers.
-- Runtime roles cannot update tenant_modules or delete consents. These SECURITY DEFINER
-- functions are the only extra paths, and each one checks app_role() before it writes.

GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, DELETE ON consents TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION list_schedule_tenants(p_purpose text)
RETURNS TABLE (tenant_id uuid, timezone text, report_day integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_statuses text[];
BEGIN
  PERFORM rollup_require_role('system');
  IF p_purpose = 'metrics' THEN
    -- Default tenant status is onboarding. Those clients already use the dashboard.
    v_statuses := ARRAY['onboarding', 'active'];
  ELSIF p_purpose = 'retention' THEN
    v_statuses := ARRAY['onboarding', 'active', 'suspended', 'offboarded'];
  ELSE
    RAISE EXCEPTION 'unknown schedule purpose' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT t.id, t.timezone,
    CASE
      WHEN (m.config->>'reportDayOfMonth') ~ '^[0-9]+$'
        AND (m.config->>'reportDayOfMonth')::int BETWEEN 1 AND 28
      THEN (m.config->>'reportDayOfMonth')::int
      ELSE 1
    END
  FROM tenants t
  LEFT JOIN tenant_modules m ON m.tenant_id = t.id AND m.module_key = 'platform'
  WHERE t.status = ANY (v_statuses);
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_set_platform_setting(p_tenant uuid, p_key text, p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_text text;
  v_had_secret boolean;
BEGIN
  PERFORM rollup_require_role('admin');
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant) THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM tenant_modules WHERE tenant_id = p_tenant AND module_key = 'platform'
  ) THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_key NOT IN ('n8nWebhookUrl', 'reportDayOfMonth') THEN
    RAISE EXCEPTION 'setting is not editable' USING ERRCODE = '22023';
  END IF;
  IF p_key = 'reportDayOfMonth' THEN
    IF p_value IS NULL OR jsonb_typeof(p_value) <> 'number'
      OR (p_value #>> '{}') !~ '^[0-9]+$'
      OR (p_value #>> '{}')::int < 1
      OR (p_value #>> '{}')::int > 28 THEN
      RAISE EXCEPTION 'report day must be 1 to 28' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_key = 'n8nWebhookUrl' AND p_value IS NOT NULL THEN
    v_text := p_value #>> '{}';
    IF jsonb_typeof(p_value) <> 'string'
      OR v_text !~ '^https://[^[:space:]?#]+$'
      OR position('@' in v_text) > 0
      OR length(v_text) > 500 THEN
      RAISE EXCEPTION 'webhook url is invalid' USING ERRCODE = '22023';
    END IF;
  END IF;
  SELECT (config ? 'n8nWebhookSecret') INTO v_had_secret
  FROM tenant_modules WHERE tenant_id = p_tenant AND module_key = 'platform';
  IF p_value IS NULL THEN
    UPDATE tenant_modules
      SET config = (config - 'n8nWebhookSecret') - p_key
      WHERE tenant_id = p_tenant AND module_key = 'platform';
  ELSE
    UPDATE tenant_modules
      SET config = (config - 'n8nWebhookSecret') || jsonb_build_object(p_key, p_value)
      WHERE tenant_id = p_tenant AND module_key = 'platform';
  END IF;
  -- The plaintext push secret is stripped and is never copied into the audit row.
  PERFORM rollup_audit(
    p_tenant, 'platform.setting', 'tenant_module', p_key,
    jsonb_build_object('had_plaintext_secret', v_had_secret),
    jsonb_build_object('key', p_key, 'cleared', p_value IS NULL)
  );
END $$;
--> statement-breakpoint
CREATE FUNCTION purge_expired_consents(p_tenant uuid, p_before timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM rollup_require_role('system');
  IF p_tenant IS NULL OR p_before IS NULL THEN
    RAISE EXCEPTION 'tenant and cutoff are required' USING ERRCODE = '22023';
  END IF;
  DELETE FROM consents
    WHERE tenant_id = p_tenant
      AND revoked_at IS NOT NULL
      AND revoked_at < p_before;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    PERFORM rollup_audit(
      p_tenant, 'retention.consent', 'consent', p_tenant::text, NULL,
      jsonb_build_object('deleted', v_count)
    );
  END IF;
  RETURN v_count;
END $$;
--> statement-breakpoint
ALTER FUNCTION list_schedule_tenants(text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_platform_setting(uuid, text, jsonb) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION purge_expired_consents(uuid, timestamptz) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION list_schedule_tenants(text),
  admin_set_platform_setting(uuid, text, jsonb),
  purge_expired_consents(uuid, timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION list_schedule_tenants(text),
  purge_expired_consents(uuid, timestamptz) TO kynetic_worker;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_set_platform_setting(uuid, text, jsonb) TO kynetic_app, kynetic_worker;
