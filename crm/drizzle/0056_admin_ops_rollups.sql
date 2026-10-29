-- M8b-03 and M8b-06: staff-only aggregate views for integration health and flagged calls.
CREATE FUNCTION admin_integration_health() RETURNS TABLE (
  tenant_id uuid, tenant_name text, kind text, status text, a2p_status text,
  last_success_at timestamptz, last_error_at timestamptz, last_error text, error_count integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY SELECT i.tenant_id, t.name, i.kind, i.status, i.a2p_status,
    i.last_success_at, i.last_error_at, i.last_error, i.error_count
  FROM integrations i JOIN tenants t ON t.id = i.tenant_id ORDER BY i.last_error_at DESC NULLS LAST, t.name;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_flagged_calls() RETURNS TABLE (
  call_id uuid, tenant_id uuid, tenant_name text, contact_id uuid, started_at timestamptz,
  flag_note text, flagged_at timestamptz, flagged_by uuid
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY SELECT c.id, c.tenant_id, t.name, c.contact_id, c.started_at,
    c.flag_note, c.flagged_at, c.flagged_by
  FROM calls c JOIN tenants t ON t.id = c.tenant_id
  WHERE c.flagged AND c.flagged_by IS NULL
  ORDER BY c.flagged_at DESC NULLS LAST;
END $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_integration_health(), admin_flagged_calls() TO kynetic_app;
