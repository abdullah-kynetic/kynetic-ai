-- M8b F-62: integration health obtains A2P state from tenant phone numbers.
CREATE OR REPLACE FUNCTION admin_integration_health() RETURNS TABLE (
  tenant_id uuid, tenant_name text, kind text, status text, a2p_status text,
  last_success_at timestamptz, last_error_at timestamptz, last_error text, error_count integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY SELECT i.tenant_id, t.name, i.kind, i.status,
    coalesce((SELECT string_agg(DISTINCT pn.a2p_status, ',' ORDER BY pn.a2p_status)
      FROM phone_numbers pn WHERE pn.tenant_id = i.tenant_id AND pn.purpose IN ('sms', 'voice_sms')), 'not_registered'),
    i.last_success_at, i.last_error_at, i.last_error, i.error_count
  FROM integrations i JOIN tenants t ON t.id = i.tenant_id
  ORDER BY i.last_error_at DESC NULLS LAST, t.name;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION admin_replay_webhook(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin');
  UPDATE webhook_events SET processed_at = NULL, last_error = NULL, next_attempt_at = now()
    WHERE id = p_id AND processed_at IS NOT NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM rollup_audit(NULL, 'webhook.replay', 'webhook_event', p_id::text, NULL, jsonb_build_object('replayed', true));
  RETURN true;
END $$;
--> statement-breakpoint
-- These staff rollups and controls cross forced-RLS tenant tables; run them as the dedicated
-- BYPASSRLS rollup role, with only the table grants each function needs.
GRANT SELECT, UPDATE ON webhook_events TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_integration_health() OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_flagged_calls() OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_outbound_kill_switch(uuid, boolean) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_replay_webhook(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
