-- Service API: one shared idempotency record per write (Idempotency-Key header). The row commits in the
-- same transaction as the write it describes, so a retry replays the stored response and never repeats the
-- write. Stores a request hash and the response body, never the raw request. Rows live 24 hours.
CREATE TABLE service_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  token_id uuid NOT NULL,
  key text NOT NULL CHECK (key ~ '^[A-Za-z0-9_-]{8,128}$'),
  method text NOT NULL,
  path text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  status integer NOT NULL CHECK (status BETWEEN 200 AND 299),
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key),
  FOREIGN KEY (token_id, tenant_id) REFERENCES service_tokens(id, tenant_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX service_idempotency_created_idx ON service_idempotency (created_at);
--> statement-breakpoint
SELECT app_enable_tenant_rls('service_idempotency'::regclass);
--> statement-breakpoint
-- Immutable for the runtime roles; only the purge function below deletes.
REVOKE UPDATE, DELETE ON service_idempotency FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT SELECT, DELETE ON service_idempotency TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION service_idempotency_purge(p_older_than interval DEFAULT interval '24 hours')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  DELETE FROM service_idempotency WHERE created_at < now() - p_older_than;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
--> statement-breakpoint
ALTER FUNCTION service_idempotency_purge(interval) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION service_idempotency_purge(interval) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION service_idempotency_purge(interval) TO kynetic_worker;
