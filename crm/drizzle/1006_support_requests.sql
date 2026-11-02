-- M20-06 (F-106 area): client support requests. Clients submit and read their own; Kynetic staff list
-- and change status only through the two rollup functions below. No sends, jobs or provider calls.
CREATE TABLE support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  submitted_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX support_requests_tenant_idx ON support_requests (tenant_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX support_requests_status_idx ON support_requests (status, created_at DESC);
--> statement-breakpoint
SELECT app_enable_tenant_rls('support_requests'::regclass);
--> statement-breakpoint
REVOKE UPDATE, DELETE ON support_requests FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT, UPDATE ON support_requests TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION admin_list_support_requests() RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  subject text,
  body text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY
    SELECT s.id, s.tenant_id, t.name, s.subject, s.body, s.status, s.created_at, s.updated_at, s.resolved_at
    FROM support_requests s JOIN tenants t ON t.id = s.tenant_id
    ORDER BY (s.status = 'resolved'), s.created_at DESC
    LIMIT 200;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_set_support_request_status(p_id uuid, p_status text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tenant uuid;
  v_before text;
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  IF app_impersonator_id() IS NOT NULL OR app_read_only() THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('open', 'in_progress', 'resolved') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  SELECT s.tenant_id, s.status INTO v_tenant, v_before FROM support_requests s WHERE s.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE support_requests s
    SET status = p_status, updated_at = now(),
        resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END
    WHERE s.id = p_id;
  PERFORM rollup_audit(v_tenant, 'support.status', 'support_request', p_id::text,
    jsonb_build_object('status', v_before), jsonb_build_object('status', p_status));
  RETURN true;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_list_support_requests() OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_set_support_request_status(uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION admin_list_support_requests(), admin_set_support_request_status(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_list_support_requests(), admin_set_support_request_status(uuid, text) TO kynetic_app;
