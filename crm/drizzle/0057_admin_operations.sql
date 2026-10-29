-- M8b-07: staff-only operational controls.
CREATE FUNCTION admin_replay_webhook(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin');
  UPDATE webhook_events SET processed_at = NULL, error = NULL, next_attempt_at = now()
    WHERE id = p_id AND processed_at IS NOT NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM rollup_audit(NULL, 'webhook.replay', 'webhook_event', p_id::text, NULL, jsonb_build_object('replayed', true));
  RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_set_outbound_kill_switch(p_tenant uuid, p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin');
  UPDATE tenant_modules SET config = jsonb_set(coalesce(config, '{}'::jsonb), '{outbound_kill_switch}', to_jsonb(p_enabled)), changed_at = now(), changed_by = app_user_id()
    WHERE tenant_id = p_tenant AND module_key = 'platform';
  PERFORM rollup_audit(p_tenant, 'outbound.kill_switch', 'tenant', p_tenant::text, NULL, jsonb_build_object('enabled', p_enabled));
END $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_replay_webhook(uuid), admin_set_outbound_kill_switch(uuid, boolean) TO kynetic_app;
