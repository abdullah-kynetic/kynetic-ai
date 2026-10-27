-- M8a-03: cross-tenant user management for Kynetic staff (F-61, SECURITY 2.2 and 2.5, DC-092).
-- SECURITY DEFINER functions owned by kynetic_rollup, in the pattern of 0005 and 0013: each checks
-- the caller's role first, confirms the caller is an active staff user in the database, writes its
-- audit row in the same transaction, and takes no tenant id the caller could not otherwise see.
-- Admin may do everything. A VA may list users, invite client users and reset client users, and
-- nothing else (matrix row "Users across tenants").

GRANT UPDATE (role) ON memberships TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, UPDATE (revoked_at) ON invitations TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
-- The caller named by the session must be an active Kynetic user holding the role the session claims.
-- Returns that role. Stops a stale or forged role claim from reaching the cross-tenant paths.
CREATE FUNCTION rollup_active_staff() RETURNS text
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role text;
BEGIN
  SELECT kynetic_role INTO v_role FROM users
   WHERE id = app_user_id() AND disabled_at IS NULL AND kynetic_role = app_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  RETURN v_role;
END $$;
--> statement-breakpoint
-- One row per membership, plus one row for a Kynetic user with none, plus one row per pending invite
-- that has no account yet. Admin and VA may read (matrix: Kynetic staff see users across tenants).
CREATE FUNCTION admin_list_users(p_tenant uuid DEFAULT NULL, p_search text DEFAULT NULL, p_limit integer DEFAULT 200)
  RETURNS TABLE (
    user_id uuid, invitation_id uuid, email text, name text, kynetic_role text, status text,
    tenant_id uuid, tenant_name text, membership_role text, last_login_at timestamptz,
    invite_expires_at timestamptz
  ) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_like text;
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  PERFORM rollup_active_staff();
  v_like := CASE WHEN p_search IS NULL OR btrim(p_search) = '' THEN NULL
                 ELSE '%' || replace(replace(replace(lower(btrim(p_search)), '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
  RETURN QUERY
  SELECT r.uid, r.inv, r.mail, r.uname, r.krole, r.st, r.tid, r.tname, r.mrole, r.login, r.inv_exp FROM (
    SELECT u.id AS uid, NULL::uuid AS inv, u.email AS mail, u.name AS uname, u.kynetic_role AS krole,
           CASE WHEN u.disabled_at IS NOT NULL THEN 'disabled' ELSE 'active' END AS st,
           m.tenant_id AS tid, t.name AS tname, m.role AS mrole, u.last_login_at AS login,
           NULL::timestamptz AS inv_exp
      FROM users u
      LEFT JOIN memberships m ON m.user_id = u.id
      LEFT JOIN tenants t ON t.id = m.tenant_id
     WHERE (p_tenant IS NULL OR m.tenant_id = p_tenant)
       AND (v_like IS NULL OR lower(u.email) LIKE v_like OR lower(coalesce(u.name, '')) LIKE v_like)
    UNION ALL
    SELECT NULL::uuid, i.id, i.email, NULL::text, NULL::text, 'invited',
           i.tenant_id, t.name, i.role, NULL::timestamptz, i.expires_at
      FROM invitations i
      JOIN tenants t ON t.id = i.tenant_id
     WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
       AND (p_tenant IS NULL OR i.tenant_id = p_tenant)
       AND (v_like IS NULL OR lower(i.email) LIKE v_like)
       AND NOT EXISTS (SELECT 1 FROM users x WHERE x.email = i.email)
  ) r
  ORDER BY (r.st = 'invited'), lower(r.mail), r.tname NULLS FIRST
  LIMIT least(greatest(p_limit, 1), 1000);
END $$;
--> statement-breakpoint
-- Invite a client user (owner or staff) into a tenant. Single-use, hash only, bound to the email.
-- Replaces any earlier pending invite for the same email and tenant. Admin and VA.
CREATE FUNCTION admin_invite_user(p_tenant uuid, p_email text, p_role text, p_token_hash text, p_expires_at timestamptz)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_status text;
  v_user users%ROWTYPE;
  v_id uuid;
  v_revoked integer;
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  PERFORM rollup_active_staff();
  IF p_role NOT IN ('owner', 'staff') THEN
    RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'invite already expired' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_status FROM tenants WHERE id = p_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'offboarded' THEN
    RAISE EXCEPTION 'tenant is offboarded' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_user FROM users WHERE email = v_email;
  IF FOUND THEN
    IF v_user.kynetic_role IS NOT NULL THEN
      RAISE EXCEPTION 'Kynetic staff do not join client tenants' USING ERRCODE = '22023';
    END IF;
    IF v_user.disabled_at IS NOT NULL THEN
      RAISE EXCEPTION 'user is deactivated' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM memberships WHERE tenant_id = p_tenant AND user_id = v_user.id) THEN
      RAISE EXCEPTION 'already a member' USING ERRCODE = '23505';
    END IF;
  END IF;
  UPDATE invitations SET revoked_at = now()
   WHERE tenant_id = p_tenant AND email = v_email AND accepted_at IS NULL AND revoked_at IS NULL;
  GET DIAGNOSTICS v_revoked = ROW_COUNT;
  INSERT INTO invitations (tenant_id, email, role, token_hash, invited_by, expires_at)
    VALUES (p_tenant, v_email, p_role, p_token_hash, app_user_id(), p_expires_at) RETURNING id INTO v_id;
  PERFORM rollup_audit(p_tenant, 'user.invite', 'invitation', v_id::text, NULL,
    jsonb_build_object('role', p_role, 'expires_at', p_expires_at, 'replaced_pending', v_revoked));
  RETURN v_id;
END $$;
--> statement-breakpoint
-- Deactivate (F-61, SECURITY 2.5): in one transaction mark the user disabled, delete every session and
-- revoke pending invites for the email. Admin only, never your own account. Memberships stay, so a
-- later reactivation restores access.
CREATE FUNCTION admin_deactivate_user(p_user uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user users%ROWTYPE;
  v_sessions integer;
  v_invites integer;
BEGIN
  PERFORM rollup_require_role('admin');
  PERFORM rollup_active_staff();
  IF p_user = app_user_id() THEN
    RAISE EXCEPTION 'you cannot deactivate your own account' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_user FROM users WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE users SET disabled_at = coalesce(disabled_at, now()), updated_at = now() WHERE id = p_user;
  DELETE FROM sessions WHERE user_id = p_user;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;
  UPDATE invitations SET revoked_at = now()
   WHERE email = v_user.email AND accepted_at IS NULL AND revoked_at IS NULL;
  GET DIAGNOSTICS v_invites = ROW_COUNT;
  PERFORM rollup_audit(NULL, 'user.deactivate', 'user', p_user::text,
    jsonb_build_object('disabled', v_user.disabled_at IS NOT NULL),
    jsonb_build_object('disabled', true, 'sessions_revoked', v_sessions, 'invites_revoked', v_invites));
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_reactivate_user(p_user uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_was timestamptz;
BEGIN
  PERFORM rollup_require_role('admin');
  PERFORM rollup_active_staff();
  SELECT disabled_at INTO v_was FROM users WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_was IS NULL THEN
    RETURN;
  END IF;
  UPDATE users SET disabled_at = NULL, updated_at = now() WHERE id = p_user;
  PERFORM rollup_audit(NULL, 'user.reactivate', 'user', p_user::text,
    jsonb_build_object('disabled', true), jsonb_build_object('disabled', false));
END $$;
--> statement-breakpoint
-- Reset a client user's access (F-61): sign them out everywhere so they sign in again through Google
-- or a fresh magic link. There are no passwords to reset. Admin and VA, client users only; staff
-- accounts go through the admin TOTP reset (F-98).
CREATE FUNCTION admin_reset_client_user(p_user uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user users%ROWTYPE;
  v_sessions integer;
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  PERFORM rollup_active_staff();
  SELECT * INTO v_user FROM users WHERE id = p_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_user.kynetic_role IS NOT NULL THEN
    RAISE EXCEPTION 'staff accounts are not reset here' USING ERRCODE = '42501';
  END IF;
  IF v_user.disabled_at IS NOT NULL THEN
    RAISE EXCEPTION 'user is deactivated' USING ERRCODE = '22023';
  END IF;
  DELETE FROM sessions WHERE user_id = p_user;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;
  PERFORM rollup_audit(NULL, 'user.reset', 'user', p_user::text, NULL,
    jsonb_build_object('sessions_revoked', v_sessions));
END $$;
--> statement-breakpoint
-- Change a client user's role in one tenant. Admin only. A tenant keeps at least one owner.
CREATE FUNCTION admin_set_membership_role(p_tenant uuid, p_user uuid, p_role text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before text;
BEGIN
  PERFORM rollup_require_role('admin');
  PERFORM rollup_active_staff();
  IF p_role NOT IN ('owner', 'staff') THEN
    RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
  END IF;
  SELECT role INTO v_before FROM memberships WHERE tenant_id = p_tenant AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before = p_role THEN
    RETURN;
  END IF;
  IF v_before = 'owner' AND NOT EXISTS (
    SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.tenant_id = p_tenant AND m.role = 'owner' AND m.user_id <> p_user AND u.disabled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'a tenant needs at least one owner' USING ERRCODE = '23514';
  END IF;
  UPDATE memberships SET role = p_role WHERE tenant_id = p_tenant AND user_id = p_user;
  PERFORM rollup_audit(p_tenant, 'user.membership_role', 'membership', p_user::text,
    jsonb_build_object('role', v_before), jsonb_build_object('role', p_role));
END $$;
--> statement-breakpoint
-- Grant, change or remove a Kynetic admin or VA role (matrix: manage admin accounts, admin only).
-- Not your own account, so an admin always remains. The target is signed out so the new role and the
-- TOTP rule apply from the next sign-in. Used instead of admin_set_kynetic_role (0005), which has
-- neither guard.
CREATE FUNCTION admin_change_staff_role(p_user uuid, p_role text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_before text;
  v_sessions integer;
BEGIN
  PERFORM rollup_require_role('admin');
  PERFORM rollup_active_staff();
  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'va') THEN
    RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
  END IF;
  IF p_user = app_user_id() THEN
    RAISE EXCEPTION 'you cannot change your own role' USING ERRCODE = '42501';
  END IF;
  SELECT kynetic_role INTO v_before FROM users WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before IS NOT DISTINCT FROM p_role THEN
    RETURN;
  END IF;
  UPDATE users SET kynetic_role = p_role, updated_at = now() WHERE id = p_user;
  DELETE FROM sessions WHERE user_id = p_user;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;
  PERFORM rollup_audit(NULL, 'user.kynetic_role', 'user', p_user::text,
    jsonb_build_object('kynetic_role', v_before),
    jsonb_build_object('kynetic_role', p_role, 'sessions_revoked', v_sessions));
END $$;
--> statement-breakpoint
ALTER FUNCTION rollup_active_staff() OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_list_users(uuid, text, integer) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_invite_user(uuid, text, text, text, timestamptz) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_deactivate_user(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_reactivate_user(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_reset_client_user(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_membership_role(uuid, uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_change_staff_role(uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION rollup_active_staff(), admin_list_users(uuid, text, integer),
  admin_invite_user(uuid, text, text, text, timestamptz), admin_deactivate_user(uuid),
  admin_reactivate_user(uuid), admin_reset_client_user(uuid), admin_set_membership_role(uuid, uuid, text),
  admin_change_staff_role(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_list_users(uuid, text, integer),
  admin_invite_user(uuid, text, text, text, timestamptz), admin_deactivate_user(uuid),
  admin_reactivate_user(uuid), admin_reset_client_user(uuid), admin_set_membership_role(uuid, uuid, text),
  admin_change_staff_role(uuid, text) TO kynetic_app;
