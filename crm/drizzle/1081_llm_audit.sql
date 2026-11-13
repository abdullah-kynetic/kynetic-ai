-- P5-S4: every prompt sent to a model and every answer that touches a client record, with who asked
-- and who approved. Append-only except the approval columns, which can move once from pending to
-- approved or rejected. Prompts hold client data, so the table is tenant-scoped like any other.
CREATE TABLE llm_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  usage_id uuid NOT NULL,
  task text NOT NULL CHECK (task IN ('call_summary', 'message_draft', 'lead_brief')),
  subject_type text NOT NULL CHECK (length(btrim(subject_type)) > 0),
  subject_id text NOT NULL CHECK (length(btrim(subject_id)) > 0),
  requested_by uuid REFERENCES users(id),
  data_handling text NOT NULL CHECK (data_handling IN ('no_retention', 'standard')),
  prompt jsonb NOT NULL,
  output text,
  approval_status text NOT NULL DEFAULT 'not_required'
    CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, usage_id) REFERENCES llm_usage (tenant_id, id) ON DELETE RESTRICT,
  CHECK (approval_status NOT IN ('approved', 'rejected') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX llm_audit_tenant_subject_idx ON llm_audit (tenant_id, subject_type, subject_id, created_at DESC);
--> statement-breakpoint
SELECT app_enable_tenant_rls('llm_audit'::regclass);
--> statement-breakpoint
REVOKE UPDATE, DELETE ON llm_audit FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT UPDATE (approval_status, approved_by, approved_at) ON llm_audit TO kynetic_app;
--> statement-breakpoint
-- Only pending can move, and only to approved or rejected. No path back.
CREATE FUNCTION llm_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.approval_status <> 'pending' OR NEW.approval_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'approval can only move from pending to approved or rejected' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER llm_audit_guard BEFORE UPDATE ON llm_audit
  FOR EACH ROW EXECUTE FUNCTION llm_audit_guard();
