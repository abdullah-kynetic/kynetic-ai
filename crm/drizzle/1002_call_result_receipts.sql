-- M13-03 / F-26,F-77,F-89: immutable relay idempotency, with no duplicate PII payload storage.
CREATE TABLE call_result_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  call_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('elevenlabs', 'retell')),
  provider_call_id text NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_id),
  UNIQUE (tenant_id, provider, provider_call_id),
  FOREIGN KEY (tenant_id, call_id) REFERENCES calls(tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('call_result_receipts'::regclass);
--> statement-breakpoint
REVOKE UPDATE, DELETE ON call_result_receipts FROM kynetic_app, kynetic_worker;
