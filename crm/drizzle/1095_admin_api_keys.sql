-- Service API admin keys (owner only), the stop-all-keys switch, and idempotency records for admin-key writes.
-- Order: merge/deploy 1094 (account templates) first; drizzle skips a migration older than the last applied one.
CREATE TABLE admin_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix text NOT NULL UNIQUE CHECK (prefix ~ '^[0-9a-f]{16}$'),
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  allowed_cidrs text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE admin_api_keys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE admin_api_keys FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY admin_api_keys_rollup ON admin_api_keys TO kynetic_rollup USING (true) WITH CHECK (true);
--> statement-breakpoint
REVOKE ALL ON admin_api_keys FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON admin_api_keys TO kynetic_rollup;
--> statement-breakpoint
CREATE TABLE service_api_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE RESTRICT
);
--> statement-breakpoint
INSERT INTO service_api_control (id, enabled) VALUES (true, true);
--> statement-breakpoint
ALTER TABLE service_api_control ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE service_api_control FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY service_api_control_rollup ON service_api_control TO kynetic_rollup USING (true) WITH CHECK (true);
--> statement-breakpoint
REVOKE ALL ON service_api_control FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT, UPDATE ON service_api_control TO kynetic_rollup;
--> statement-breakpoint
ALTER TABLE service_idempotency ALTER COLUMN token_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE service_idempotency ADD COLUMN admin_key_id uuid REFERENCES admin_api_keys(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE service_idempotency ADD CONSTRAINT service_idempotency_one_credential
  CHECK ((token_id IS NULL) <> (admin_key_id IS NULL));
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION service_api_enabled() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE((SELECT enabled FROM service_api_control WHERE id), false) $$;
--> statement-breakpoint
CREATE FUNCTION service_api_set_enabled(p_enabled boolean) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF app_role() <> 'admin' OR app_user_id() IS NULL OR app_read_only() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  UPDATE service_api_control SET enabled = p_enabled, updated_at = now(), updated_by = app_user_id() WHERE id;
  RETURN p_enabled;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_api_key_lookup(p_prefix text)
RETURNS TABLE (id uuid, key_hash text, allowed_cidrs text[], revoked_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT k.id, k.key_hash, k.allowed_cidrs, k.revoked_at FROM admin_api_keys k WHERE k.prefix = p_prefix $$;
--> statement-breakpoint
CREATE FUNCTION admin_api_key_touch(p_id uuid) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE admin_api_keys SET last_used_at = now() WHERE id = p_id AND revoked_at IS NULL $$;
--> statement-breakpoint
-- Resolves the client an admin key is acting for. Call only after the key verified.
CREATE FUNCTION admin_api_key_client(p_slug text) RETURNS TABLE (tenant_id uuid, status text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.id, t.status::text FROM tenants t WHERE t.slug = p_slug $$;
--> statement-breakpoint
CREATE FUNCTION admin_api_key_issue(p_prefix text, p_hash text, p_label text, p_cidrs text[]) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE new_id uuid;
BEGIN
  IF app_role() <> 'admin' OR app_user_id() IS NULL OR app_read_only() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  INSERT INTO admin_api_keys (prefix, key_hash, label, created_by, allowed_cidrs)
    VALUES (p_prefix, p_hash, p_label, app_user_id(), COALESCE(p_cidrs, '{}')) RETURNING admin_api_keys.id INTO new_id;
  RETURN new_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_api_key_list()
RETURNS TABLE (id uuid, label text, allowed_cidrs text[], last_used_at timestamptz, revoked_at timestamptz, created_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF app_role() <> 'admin' OR app_user_id() IS NULL THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT k.id, k.label, k.allowed_cidrs, k.last_used_at, k.revoked_at, k.created_at
    FROM admin_api_keys k ORDER BY k.created_at DESC;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_api_key_revoke(p_id uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  IF app_role() <> 'admin' OR app_user_id() IS NULL OR app_read_only() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  UPDATE admin_api_keys SET revoked_at = now() WHERE id = p_id AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;
--> statement-breakpoint
ALTER FUNCTION service_api_enabled() OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION service_api_set_enabled(boolean) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_api_key_lookup(text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_api_key_touch(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_api_key_client(text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_api_key_issue(text, text, text, text[]) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_api_key_list() OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_api_key_revoke(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION service_api_enabled(), service_api_set_enabled(boolean), admin_api_key_lookup(text),
  admin_api_key_touch(uuid), admin_api_key_client(text), admin_api_key_issue(text, text, text, text[]),
  admin_api_key_list(), admin_api_key_revoke(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION service_api_enabled(), service_api_set_enabled(boolean), admin_api_key_lookup(text),
  admin_api_key_touch(uuid), admin_api_key_client(text), admin_api_key_issue(text, text, text, text[]),
  admin_api_key_list(), admin_api_key_revoke(uuid) TO kynetic_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION service_api_enabled() TO kynetic_worker;
