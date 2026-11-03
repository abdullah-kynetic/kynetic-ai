-- M8b-05: expose only the backup history fields needed by Kynetic staff.
GRANT SELECT ON backup_runs TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION admin_list_backup_runs() RETURNS TABLE (
  id uuid,
  kind text,
  status text,
  started_at timestamptz,
  finished_at timestamptz,
  size_bytes bigint,
  offsite_key text,
  restore_test_passed boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY
    SELECT b.id, b.kind, b.status, b.started_at, b.finished_at, b.size_bytes,
      b.offsite_key, b.restore_test_passed
    FROM backup_runs b
    ORDER BY b.started_at DESC
    LIMIT 100;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_list_backup_runs() OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_list_backup_runs() TO kynetic_app;
