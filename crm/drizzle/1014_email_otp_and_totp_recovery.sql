-- Client email codes and staff authenticator recovery.
-- Codes are audited without the code or the raw address. Backup codes are not a sign-in path.
-- Accepting an invitation runs as kynetic_rollup so the auth role never writes memberships itself.
-- The emergency reset is executable by the database owner only (sole-admin break-glass).
GRANT INSERT ON memberships TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION auth_record_otp(p_action text, p_user uuid, p_after jsonb)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_after jsonb;
BEGIN
  IF p_action NOT IN ('auth.otp_sent', 'auth.otp_suppressed', 'auth.otp_failed', 'auth.otp_verified') THEN
    RAISE EXCEPTION 'unknown auth event' USING ERRCODE = '22023';
  END IF;
  v_after := coalesce(p_after, '{}'::jsonb) - 'code' - 'otp' - 'email';
  IF coalesce(v_after->>'email_hash', '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'email hash required' USING ERRCODE = '22023';
  END IF;
  IF p_user IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = p_user) THEN
    RAISE EXCEPTION 'unknown user' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO audit_log (tenant_id, actor_user_id, action, entity, entity_id, after)
  VALUES (NULL, p_user, p_action, 'user', coalesce(p_user::text, 'email'), v_after);
END $$;
--> statement-breakpoint
-- Turns every live invitation for this user into a membership. Staff and disabled users are skipped.
CREATE FUNCTION accept_pending_invitations(p_user uuid)
  RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_email text;
  v_role text;
  v_disabled timestamptz;
  v_count integer := 0;
  r record;
BEGIN
  SELECT email, kynetic_role, disabled_at INTO v_email, v_role, v_disabled
    FROM users WHERE id = p_user;
  IF NOT FOUND OR v_disabled IS NOT NULL OR v_role IS NOT NULL THEN
    RETURN 0;
  END IF;
  FOR r IN
    SELECT i.id, i.tenant_id, i.role
      FROM invitations i
      JOIN tenants t ON t.id = i.tenant_id
     WHERE i.email = v_email
       AND i.accepted_at IS NULL
       AND i.revoked_at IS NULL
       AND i.expires_at > now()
       AND t.status NOT IN ('suspended', 'offboarded')
     FOR UPDATE OF i
  LOOP
    INSERT INTO memberships (tenant_id, user_id, role)
    VALUES (r.tenant_id, p_user, r.role)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
    UPDATE invitations SET accepted_at = now() WHERE id = r.id AND accepted_at IS NULL;
    INSERT INTO audit_log (tenant_id, actor_user_id, action, entity, entity_id, after)
    VALUES (r.tenant_id, p_user, 'user.invite_accepted', 'invitation', r.id::text,
            jsonb_build_object('role', r.role));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
--> statement-breakpoint
-- Sole-admin break-glass. No app session is required. The database owner runs it from the CLI.
CREATE FUNCTION emergency_reset_staff_two_factor(p_email text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_role text;
  v_was boolean;
  v_sessions integer;
BEGIN
  SELECT id, kynetic_role, two_factor_enabled INTO v_id, v_role, v_was
    FROM users WHERE email = lower(btrim(p_email));
  IF NOT FOUND OR v_role IS NULL THEN
    RAISE EXCEPTION 'staff user not found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM two_factors WHERE user_id = v_id;
  UPDATE users SET two_factor_enabled = false, updated_at = now() WHERE id = v_id;
  DELETE FROM sessions WHERE user_id = v_id;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;
  INSERT INTO audit_log (tenant_id, actor_user_id, action, entity, entity_id, before, after)
  VALUES (NULL, v_id, 'user.2fa_emergency_reset', 'user', v_id::text,
          jsonb_build_object('two_factor_enabled', v_was),
          jsonb_build_object('two_factor_enabled', false, 'sessions_revoked', v_sessions, 'via', 'emergency_cli'));
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION auth_record_otp(text, uuid, jsonb) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION accept_pending_invitations(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION emergency_reset_staff_two_factor(text) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION auth_record_otp(text, uuid, jsonb) FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION accept_pending_invitations(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION emergency_reset_staff_two_factor(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_record_otp(text, uuid, jsonb) TO kynetic_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION accept_pending_invitations(uuid) TO kynetic_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION emergency_reset_staff_two_factor(text) TO kynetic_owner;
