-- M0-12: admin and VA TOTP two-factor (F-98, SECURITY 2.1). The Better-Auth two-factor plugin keeps
-- its secret and recovery-code hashes in two_factors. Only kynetic_auth can touch that table.
-- A staff session counts as fully signed in only once two_factor_verified_at is set.
CREATE TABLE two_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  backup_codes text NOT NULL,
  verified boolean NOT NULL DEFAULT true,
  failed_verification_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN two_factor_verified_at timestamptz;
--> statement-breakpoint
REVOKE ALL ON two_factors FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
ALTER TABLE two_factors ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE two_factors FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY auth_all ON two_factors FOR ALL TO kynetic_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON two_factors TO kynetic_auth;
--> statement-breakpoint
-- The plugin flips users.two_factor_enabled when a first code is verified. That is the only user flag the
-- auth role gains; kynetic_role and disabled_at stay out of reach. Resetting it is the admin function below.
GRANT INSERT (two_factor_enabled), UPDATE (two_factor_enabled) ON users TO kynetic_auth;
--> statement-breakpoint
-- Roll-up role needs these for the reset function.
GRANT SELECT, DELETE ON two_factors TO kynetic_rollup;
--> statement-breakpoint
GRANT DELETE ON sessions TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT (id, user_id) ON sessions TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
-- Sign-in audit rows from the auth connection. A fixed list of actions, about the caller's own user
-- only; the auth role gets no other write path into audit_log.
CREATE FUNCTION auth_record_event(p_user uuid, p_action text, p_after jsonb)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_action NOT IN ('auth.2fa_enrolled', 'auth.2fa_failed', 'auth.2fa_locked', 'auth.2fa_recovery_used') THEN
    RAISE EXCEPTION 'unknown auth event' USING ERRCODE = '22023';
  END IF;
  INSERT INTO audit_log (tenant_id, actor_user_id, action, entity, entity_id, after)
  VALUES (NULL, p_user, p_action, 'user', p_user::text, p_after);
END $$;
--> statement-breakpoint
-- Admin reset of a staff member's 2FA (F-98, F-101). Another admin only: never your own account.
-- Removes the secret and recovery codes, signs the person out everywhere, and audits before and after.
CREATE FUNCTION admin_reset_staff_two_factor(p_user uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role text;
  v_was boolean;
  v_sessions integer;
BEGIN
  PERFORM rollup_require_role('admin');
  IF p_user = app_user_id() THEN
    RAISE EXCEPTION 'reset needs another admin' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = app_user_id() AND kynetic_role = 'admin' AND disabled_at IS NULL) THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  SELECT kynetic_role, two_factor_enabled INTO v_role, v_was FROM users WHERE id = p_user;
  IF NOT FOUND OR v_role IS NULL THEN
    RAISE EXCEPTION 'staff user not found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM two_factors WHERE user_id = p_user;
  UPDATE users SET two_factor_enabled = false, updated_at = now() WHERE id = p_user;
  DELETE FROM sessions WHERE user_id = p_user;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;
  PERFORM rollup_audit(NULL, 'user.2fa_reset', 'user', p_user::text,
    jsonb_build_object('two_factor_enabled', v_was),
    jsonb_build_object('two_factor_enabled', false, 'sessions_revoked', v_sessions));
END $$;
--> statement-breakpoint
ALTER FUNCTION auth_record_event(uuid, text, jsonb) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_reset_staff_two_factor(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION auth_record_event(uuid, text, jsonb), admin_reset_staff_two_factor(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_record_event(uuid, text, jsonb) TO kynetic_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_reset_staff_two_factor(uuid) TO kynetic_app;
