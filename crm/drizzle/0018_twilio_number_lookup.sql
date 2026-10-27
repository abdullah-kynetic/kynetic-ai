-- M4-08: resolve a Twilio number to its tenant before any tenant context exists (F-74, SECURITY 3.6
-- item 6: the tenant comes from our own number mapping, never from the payload). A Twilio webhook
-- carries no session, so tenant RLS on phone_numbers would hide every row from the worker. This
-- SECURITY DEFINER function, owned by the NOLOGIN roll-up role, returns only the tenant id and the
-- sending number's A2P status for one unreleased number. It takes no tenant argument and cannot list.

GRANT SELECT ON phone_numbers TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION phone_number_tenant_lookup(p_e164 text)
RETURNS TABLE (tenant_id uuid, a2p_status text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT n.tenant_id, n.a2p_status
  FROM phone_numbers n
  WHERE n.e164 = p_e164 AND n.released_at IS NULL $$;
--> statement-breakpoint
ALTER FUNCTION phone_number_tenant_lookup(text) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION phone_number_tenant_lookup(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION phone_number_tenant_lookup(text) TO kynetic_app, kynetic_worker;
