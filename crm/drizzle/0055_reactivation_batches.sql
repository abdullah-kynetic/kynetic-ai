-- M7-08 / F-82: one-time, tenant-scoped reactivation campaign records.
CREATE TABLE reactivation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'launched' CHECK (status IN ('launched','completed','failed')),
  requested_count integer NOT NULL DEFAULT 0 CHECK (requested_count >= 0),
  eligible_count integer NOT NULL DEFAULT 0 CHECK (eligible_count >= 0),
  enrolled_count integer NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  blocked_count integer NOT NULL DEFAULT 0 CHECK (blocked_count >= 0),
  launched_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX reactivation_batches_tenant_idx ON reactivation_batches (tenant_id, created_at DESC);
--> statement-breakpoint
SELECT app_enable_tenant_rls('reactivation_batches'::regclass);
