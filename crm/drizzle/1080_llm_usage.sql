-- P5-S3: model usage metering and a per-client monthly cap. llm_usage is append-only (no update or
-- delete for the runtime roles). Costs are in millionths of a dollar because one call costs a fraction
-- of a cent. A NULL cap on a tenant means "use the platform default" (LLM_DEFAULT_MONTHLY_CAP_CENTS).
CREATE TABLE llm_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  task text NOT NULL CHECK (task IN ('call_summary', 'message_draft', 'lead_brief')),
  model text NOT NULL,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'failed')),
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  cost_micros bigint NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
  cost_known boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX llm_usage_tenant_created_idx ON llm_usage (tenant_id, created_at DESC);
--> statement-breakpoint
SELECT app_enable_tenant_rls('llm_usage'::regclass);
--> statement-breakpoint
REVOKE UPDATE, DELETE ON llm_usage FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
ALTER TABLE tenants ADD COLUMN llm_monthly_cap_cents integer CHECK (llm_monthly_cap_cents >= 0);
--> statement-breakpoint
ALTER TABLE usage_daily ADD COLUMN llm_cost_micros bigint NOT NULL DEFAULT 0 CHECK (llm_cost_micros >= 0);
--> statement-breakpoint
GRANT SELECT ON llm_usage TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION admin_set_llm_cap(p_tenant uuid, p_cents integer)
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
  SELECT llm_monthly_cap_cents INTO v_before FROM tenants WHERE id = p_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE tenants SET llm_monthly_cap_cents = p_cents, updated_at = now() WHERE id = p_tenant;
  PERFORM rollup_audit(p_tenant, 'tenant.llm_cap', 'tenant', p_tenant::text,
    jsonb_build_object('llm_monthly_cap_cents', v_before),
    jsonb_build_object('llm_monthly_cap_cents', p_cents));
END $$;
--> statement-breakpoint
CREATE FUNCTION note_llm_cap_reached(p_tenant uuid)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text;
  v_zone text;
  v_month text;
  v_id uuid;
BEGIN
  IF app_tenant_id() IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  SELECT name, timezone INTO v_name, v_zone FROM tenants WHERE id = p_tenant;
  IF v_name IS NULL THEN RETURN false; END IF;
  v_month := to_char(now() AT TIME ZONE coalesce(v_zone, 'UTC'), 'YYYY-MM');
  INSERT INTO staff_notifications (kind, title, body, link, dedupe_key)
  VALUES (
    'spend_cap',
    'AI spend cap reached',
    v_name || ' reached the monthly AI spend cap. New model calls are blocked. The cap was not raised.',
    '/admin/usage',
    'llm-cap:' || p_tenant::text || ':' || v_month
  )
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN false; END IF;
  PERFORM rollup_audit(p_tenant, 'tenant.llm_cap_reached', 'tenant', p_tenant::text, NULL,
    jsonb_build_object('month', v_month));
  RETURN true;
END $$;
--> statement-breakpoint
DROP FUNCTION admin_usage_month(date);
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
    cap_cents integer,
    llm_cost_micros bigint,
    llm_cap_cents integer
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
      t.monthly_spend_cap_cents,
      coalesce(sum(u.llm_cost_micros), 0)::bigint,
      t.llm_monthly_cap_cents
    FROM tenants t
    LEFT JOIN usage_daily u
      ON u.tenant_id = t.id AND u.day >= p_month AND u.day < (p_month + interval '1 month')::date
    GROUP BY t.id
    ORDER BY t.name;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_llm_cap(uuid, integer) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION note_llm_cap_reached(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_usage_month(date) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION admin_set_llm_cap(uuid, integer), note_llm_cap_reached(uuid), admin_usage_month(date) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_set_llm_cap(uuid, integer), admin_usage_month(date) TO kynetic_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION note_llm_cap_reached(uuid) TO kynetic_app, kynetic_worker;
