-- P6-S6 (KI-028): editable automation copy and cadence. Each edit is a numbered version of an
-- automation's steps. A version starts pending, a person approves or rejects it, and only an
-- approved version is written to automation_steps. Older versions stay as the history.
CREATE TABLE automation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  automation_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  steps jsonb NOT NULL CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) BETWEEN 1 AND 6),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  proposed_by uuid REFERENCES users(id),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  decision_note text,
  UNIQUE (tenant_id, id),
  UNIQUE (automation_id, version),
  FOREIGN KEY (tenant_id, automation_id) REFERENCES automations (tenant_id, id) ON DELETE CASCADE,
  CHECK ((status = 'pending') = (decided_at IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX automation_versions_one_pending ON automation_versions (automation_id) WHERE status = 'pending';
--> statement-breakpoint
SELECT app_enable_tenant_rls('automation_versions'::regclass);
