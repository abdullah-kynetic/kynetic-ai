-- M8b F-101: a manual replay is for failed, unprocessed events and must enqueue real work.
CREATE OR REPLACE FUNCTION admin_replay_webhook(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin');
  UPDATE webhook_events SET last_error = NULL, next_attempt_at = now()
    WHERE id = p_id AND processed_at IS NULL AND last_error IS NOT NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM rollup_audit(NULL, 'webhook.replay', 'webhook_event', p_id::text, NULL, jsonb_build_object('replayed', true));
  RETURN true;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_replay_webhook(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION admin_list_failed_webhooks() RETURNS TABLE (
  event_id uuid, tenant_id uuid, tenant_name text, source text, external_id text,
  attempts integer, last_error text, received_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin');
  RETURN QUERY SELECT w.id, w.tenant_id, coalesce(t.name, 'Platform'), w.source,
    w.external_id, w.attempts, w.last_error, w.received_at
  FROM webhook_events w LEFT JOIN tenants t ON t.id = w.tenant_id
  WHERE w.processed_at IS NULL AND w.last_error IS NOT NULL
  ORDER BY w.received_at DESC LIMIT 50;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_list_failed_webhooks() OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_list_failed_webhooks() TO kynetic_app;
