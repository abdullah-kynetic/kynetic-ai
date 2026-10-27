-- M0-20: pre-auth lookup of a service token by its prefix (F-89, SECURITY 2.3 item 9).
-- A bearer request has no tenant context yet, so the tenant RLS on service_tokens would hide the
-- row. These two SECURITY DEFINER functions, owned by the NOLOGIN roll-up role, are the only way
-- the web app or worker can resolve a prefix to a token, and they return nothing but what the
-- verifier needs. They take no tenant argument and cannot list tokens.

GRANT SELECT ON service_tokens TO kynetic_rollup;
--> statement-breakpoint
GRANT UPDATE (last_used_at) ON service_tokens TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION service_token_lookup(p_prefix text)
RETURNS TABLE (id uuid, tenant_id uuid, key_hash text, scopes text[], revoked_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.id, t.tenant_id, t.key_hash, t.scopes, t.revoked_at
  FROM service_tokens t
  WHERE t.prefix = p_prefix $$;
--> statement-breakpoint
-- Called only after the hash matched and the token is not revoked. Bounded to one column of one row.
CREATE FUNCTION service_token_touch(p_id uuid) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE service_tokens SET last_used_at = now() WHERE id = p_id AND revoked_at IS NULL $$;
--> statement-breakpoint
ALTER FUNCTION service_token_lookup(text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION service_token_touch(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION service_token_lookup(text), service_token_touch(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION service_token_lookup(text), service_token_touch(uuid) TO kynetic_app, kynetic_worker;
