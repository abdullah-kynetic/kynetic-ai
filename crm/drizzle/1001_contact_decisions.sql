-- M12-03 / F-74,F-89: evidence only. Never grants permission to contact a lead.
CREATE TABLE contact_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts(tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('contact_decisions'::regclass);
--> statement-breakpoint
REVOKE UPDATE, DELETE ON contact_decisions FROM kynetic_app, kynetic_worker;
