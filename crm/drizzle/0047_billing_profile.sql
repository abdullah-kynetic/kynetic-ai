-- M8a-07: tenant billing profile (F-99, F-86). Admin-only: the standard tenant policies named the
-- tenant's own owner and staff, so they are replaced by an admin-only SELECT policy and the app role
-- loses every write privilege. Writes go through the SECURITY DEFINER functions below, which check
-- app_role() = 'admin' first and write an audit_log row in the same transaction (SECURITY 2.2, F-99).

GRANT SELECT ON module_prices TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON tenant_billing, tenant_billing_modules TO kynetic_rollup;
--> statement-breakpoint
DROP POLICY tenant_select ON tenant_billing;
--> statement-breakpoint
DROP POLICY tenant_insert ON tenant_billing;
--> statement-breakpoint
DROP POLICY tenant_update ON tenant_billing;
--> statement-breakpoint
DROP POLICY tenant_delete ON tenant_billing;
--> statement-breakpoint
DROP POLICY tenant_select ON tenant_billing_modules;
--> statement-breakpoint
DROP POLICY tenant_insert ON tenant_billing_modules;
--> statement-breakpoint
DROP POLICY tenant_update ON tenant_billing_modules;
--> statement-breakpoint
DROP POLICY tenant_delete ON tenant_billing_modules;
--> statement-breakpoint
REVOKE ALL ON tenant_billing, tenant_billing_modules FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT ON tenant_billing, tenant_billing_modules TO kynetic_app;
--> statement-breakpoint
CREATE POLICY billing_admin_select ON tenant_billing FOR SELECT TO kynetic_app
  USING (tenant_id = app_tenant_id() AND app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY billing_modules_admin_select ON tenant_billing_modules FOR SELECT TO kynetic_app
  USING (tenant_id = app_tenant_id() AND app_role() = 'admin');
--> statement-breakpoint
-- Internal: ends the live snapshot for a module and, when the tenant's tier has a price for it,
-- takes a new one from module_prices as it is now. `crm` is priced per level on tier ALL; the other
-- modules per tier with no level. A module with no price row (tier not set yet) gets no snapshot and
-- shows as unpriced until an admin records it. Reactivation is a one-time fee, kept as setup.
-- Returns true when a snapshot row was written. Callers have already checked the role.
CREATE FUNCTION billing_snapshot_module(p_tenant uuid, p_module text, p_level text, p_discount integer)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tier text;
  v_price record;
  v_old record;
BEGIN
  SELECT pricing_tier INTO v_tier FROM tenants WHERE id = p_tenant;
  SELECT * INTO v_old FROM tenant_billing_modules
    WHERE tenant_id = p_tenant AND module_key = p_module AND ended_at IS NULL
    ORDER BY snapshot_at DESC LIMIT 1;
  UPDATE tenant_billing_modules SET ended_at = now()
    WHERE tenant_id = p_tenant AND module_key = p_module AND ended_at IS NULL;
  IF p_module = 'platform' THEN RETURN false; END IF;
  SELECT setup_cents, monthly_cents, one_time_cents INTO v_price FROM module_prices
    WHERE module_key = p_module
      AND ((p_module = 'crm' AND tier = 'ALL' AND level = coalesce(p_level, ''))
        OR (p_module <> 'crm' AND tier = v_tier AND level = ''));
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO tenant_billing_modules (tenant_id, module_key, level, setup_cents, monthly_cents, discount_pct)
    VALUES (p_tenant, p_module, CASE WHEN p_module = 'crm' THEN coalesce(p_level, '') ELSE '' END,
            coalesce(v_price.setup_cents, v_price.one_time_cents, 0), coalesce(v_price.monthly_cents, 0),
            coalesce(p_discount, v_old.discount_pct, 0));
  PERFORM rollup_audit(p_tenant, 'billing.snapshot', 'tenant_billing_module', p_module,
    CASE WHEN v_old.id IS NULL THEN NULL ELSE jsonb_build_object('setup_cents', v_old.setup_cents,
      'monthly_cents', v_old.monthly_cents, 'discount_pct', v_old.discount_pct, 'level', v_old.level) END,
    jsonb_build_object('tier', v_tier, 'level', coalesce(p_level, ''),
      'setup_cents', coalesce(v_price.setup_cents, v_price.one_time_cents, 0),
      'monthly_cents', coalesce(v_price.monthly_cents, 0), 'discount_pct', coalesce(p_discount, v_old.discount_pct, 0)));
  RETURN true;
END $$;
--> statement-breakpoint
-- The same toggle as 0005, plus the F-99 price snapshot: switching a module on (or changing the CRM
-- level) snapshots its current price; switching it off ends the live snapshot, which stays as history.
CREATE OR REPLACE FUNCTION set_tenant_module(p_tenant uuid, p_module text, p_enabled boolean, p_level text DEFAULT '')
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
  IF p_module <> 'platform' THEN
    IF p_enabled THEN
      PERFORM billing_snapshot_module(p_tenant, p_module, p_level, NULL);
    ELSE
      UPDATE tenant_billing_modules SET ended_at = now()
        WHERE tenant_id = p_tenant AND module_key = p_module AND ended_at IS NULL;
    END IF;
  END IF;
END $$;
--> statement-breakpoint
-- Admin action: take a fresh snapshot of one enabled module at today's module_prices for the tenant's
-- tier, optionally with a manual discount (0 to 100). Used when the tier was unset at enable time, or
-- when Abdullah agrees a discount. Earlier snapshots are ended, never edited.
CREATE FUNCTION admin_snapshot_module_price(p_tenant uuid, p_module text, p_discount integer DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_mod record;
BEGIN
  PERFORM rollup_require_role('admin');
  IF p_discount IS NOT NULL AND (p_discount < 0 OR p_discount > 100) THEN
    RAISE EXCEPTION 'discount must be between 0 and 100' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant) THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT enabled, level INTO v_mod FROM tenant_modules WHERE tenant_id = p_tenant AND module_key = p_module;
  IF NOT FOUND OR NOT v_mod.enabled OR p_module = 'platform' THEN
    RAISE EXCEPTION 'module is not enabled' USING ERRCODE = '22023';
  END IF;
  IF NOT billing_snapshot_module(p_tenant, p_module, v_mod.level, p_discount) THEN
    RAISE EXCEPTION 'no price for this tier' USING ERRCODE = '22023';
  END IF;
END $$;
--> statement-breakpoint
-- Admin action: the profile fields that are not a module price (F-99). Keys not in the patch are kept.
CREATE FUNCTION admin_set_tenant_billing(p_tenant uuid, p_patch jsonb)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before jsonb;
  v_allowed text[] := ARRAY['billing_start_date','stripe_customer_id','notes'];
  v_key text;
BEGIN
  PERFORM rollup_require_role('admin');
  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'field % is not editable here', v_key USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant) THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT to_jsonb(b) - 'tenant_id' - 'updated_by' - 'updated_at' INTO v_before FROM tenant_billing b WHERE tenant_id = p_tenant;
  INSERT INTO tenant_billing (tenant_id, billing_start_date, stripe_customer_id, notes, updated_by, updated_at)
    VALUES (p_tenant, (p_patch->>'billing_start_date')::date, p_patch->>'stripe_customer_id', p_patch->>'notes', app_user_id(), now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    billing_start_date = CASE WHEN p_patch ? 'billing_start_date' THEN (p_patch->>'billing_start_date')::date ELSE tenant_billing.billing_start_date END,
    stripe_customer_id = CASE WHEN p_patch ? 'stripe_customer_id' THEN p_patch->>'stripe_customer_id' ELSE tenant_billing.stripe_customer_id END,
    notes = CASE WHEN p_patch ? 'notes' THEN p_patch->>'notes' ELSE tenant_billing.notes END,
    updated_by = app_user_id(), updated_at = now();
  PERFORM rollup_audit(p_tenant, 'billing.update', 'tenant_billing', p_tenant::text, v_before, p_patch);
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION billing_snapshot_module(uuid, text, text, integer) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_snapshot_module_price(uuid, text, integer) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_tenant_billing(uuid, jsonb) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION billing_snapshot_module(uuid, text, text, integer),
  admin_snapshot_module_price(uuid, text, integer), admin_set_tenant_billing(uuid, jsonb) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_snapshot_module_price(uuid, text, integer),
  admin_set_tenant_billing(uuid, jsonb) TO kynetic_app;
