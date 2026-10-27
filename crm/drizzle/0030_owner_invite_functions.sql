-- M8a-02: two admin-only roll-up functions for the onboarding form (F-55, SECURITY 2.2).
-- `owner_email_in_use` lets the form refuse a duplicate owner before anything is created. `reissue_owner_invite`
-- is the "approve and send" step: it revokes the pending owner invite, marks the checklist step done, stores a fresh hashed token and returns
-- the owner's email and business name, so the email goes to the address on record and the raw token is never kept.
GRANT SELECT, UPDATE ON invitations TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, UPDATE ON onboarding_steps TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION owner_email_in_use(p_email text) RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin');
  RETURN EXISTS (SELECT 1 FROM users WHERE email = lower(btrim(p_email)))
    OR EXISTS (SELECT 1 FROM invitations
                WHERE email = lower(btrim(p_email)) AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now());
END $$;
--> statement-breakpoint
CREATE FUNCTION reissue_owner_invite(p_tenant uuid, p_token_hash text, p_expires_at timestamptz)
  RETURNS TABLE (owner_email text, tenant_name text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_email text;
  v_name text;
BEGIN
  PERFORM rollup_require_role('admin');
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'expiry must be in the future' USING ERRCODE = '22023';
  END IF;
  SELECT i.email INTO v_email FROM invitations i
   WHERE tenant_id = p_tenant AND role = 'owner' AND accepted_at IS NULL
   ORDER BY i.created_at DESC LIMIT 1;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'no pending owner invitation' USING ERRCODE = 'P0002';
  END IF;
  UPDATE invitations SET revoked_at = now()
   WHERE tenant_id = p_tenant AND role = 'owner' AND accepted_at IS NULL AND revoked_at IS NULL;
  INSERT INTO invitations (tenant_id, email, role, token_hash, invited_by, expires_at)
    VALUES (p_tenant, v_email, 'owner', p_token_hash, app_user_id(), p_expires_at);
  UPDATE onboarding_steps SET status = 'done', done_at = now()
   WHERE tenant_id = p_tenant AND step_key = 'owner_invited' AND status <> 'done';
  -- Neither the token nor its hash goes in the audit row.
  PERFORM rollup_audit(p_tenant, 'invite.send', 'invitation', NULL, NULL,
    jsonb_build_object('role', 'owner', 'expires_at', p_expires_at));
  SELECT t.name INTO v_name FROM tenants t WHERE t.id = p_tenant;
  RETURN QUERY SELECT v_email, v_name;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION owner_email_in_use(text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION reissue_owner_invite(uuid, text, timestamptz) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION owner_email_in_use(text), reissue_owner_invite(uuid, text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION owner_email_in_use(text), reissue_owner_invite(uuid, text, timestamptz) TO kynetic_app;
