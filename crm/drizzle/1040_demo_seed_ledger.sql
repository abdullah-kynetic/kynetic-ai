-- Lane B demo data ledger. Seed rows are synthetic, removable, and isolated to the allow-list.
CREATE TABLE demo_seed_records (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  table_name text NOT NULL CHECK (length(btrim(table_name)) BETWEEN 1 AND 100),
  record_id uuid NOT NULL,
  seed_batch text NOT NULL CHECK (length(btrim(seed_batch)) BETWEEN 1 AND 100),
  before jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, table_name, record_id, seed_batch)
);
--> statement-breakpoint
CREATE INDEX demo_seed_records_batch_idx
  ON demo_seed_records (seed_batch, tenant_id, created_at);
--> statement-breakpoint
SELECT app_enable_tenant_rls('demo_seed_records'::regclass);
--> statement-breakpoint
DROP POLICY tenant_select ON demo_seed_records;
--> statement-breakpoint
DROP POLICY tenant_insert ON demo_seed_records;
--> statement-breakpoint
DROP POLICY tenant_update ON demo_seed_records;
--> statement-breakpoint
DROP POLICY tenant_delete ON demo_seed_records;
--> statement-breakpoint
CREATE POLICY demo_seed_owner_read ON demo_seed_records FOR SELECT TO kynetic_app
  USING (tenant_id = app_tenant_id() AND app_role() = 'owner');
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON demo_seed_records FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
CREATE FUNCTION is_demo_seeded(p_tenant_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF app_role() <> 'owner' OR app_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM demo_seed_records
    WHERE tenant_id = p_tenant_id AND table_name = '__seed_meta__'
  );
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION is_demo_seeded(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION is_demo_seeded(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT ON demo_seed_records TO kynetic_rollup;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION is_demo_seeded(uuid) TO kynetic_app;
