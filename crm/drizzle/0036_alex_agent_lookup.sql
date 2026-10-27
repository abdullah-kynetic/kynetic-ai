-- M4-05: resolve a voice provider's agent to its tenant before any tenant context exists (F-77,
-- SECURITY 3.6 item 6: the tenant comes from our own agent mapping, never from the payload). A call
-- webhook carries no session, so tenant RLS on alex_configs would hide every row from the worker. This
-- SECURITY DEFINER function, owned by the NOLOGIN roll-up role, returns only the tenant id for one
-- provider and agent reference. It takes no tenant argument and cannot list.

GRANT SELECT ON alex_configs TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION alex_agent_tenant_lookup(p_provider text, p_agent_ref text)
RETURNS TABLE (tenant_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.tenant_id
  FROM alex_configs c
  WHERE c.provider = p_provider AND c.agent_ref = p_agent_ref $$;
--> statement-breakpoint
ALTER FUNCTION alex_agent_tenant_lookup(text, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION alex_agent_tenant_lookup(text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION alex_agent_tenant_lookup(text, text) TO kynetic_app, kynetic_worker;
