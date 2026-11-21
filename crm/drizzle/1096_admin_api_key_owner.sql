-- Service API presence (C9): the owner behind an admin key, so admin-only portal actions can check the actor.
-- Additive: no existing function changes. Order: merge/deploy after 1095 (admin API keys).
CREATE FUNCTION admin_api_key_owner(p_id uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT k.created_by FROM admin_api_keys k WHERE k.id = p_id AND k.revoked_at IS NULL $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_api_key_owner(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION admin_api_key_owner(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_api_key_owner(uuid) TO kynetic_app;
