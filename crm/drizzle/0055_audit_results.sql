-- Audit system additive migration. Apply only after backup and preview verification.
CREATE TABLE audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contact_id uuid,
  company_id uuid,
  mode text NOT NULL CHECK (mode IN ('free', 'full', 'operator')),
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_key text,
  cost_cents integer NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_runs_idempotency_uq UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX audit_runs_tenant_created_idx ON audit_runs (tenant_id, created_at DESC);
SELECT app_enable_tenant_rls('audit_runs'::regclass);
