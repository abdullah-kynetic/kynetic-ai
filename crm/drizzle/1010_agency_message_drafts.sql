CREATE TABLE agency_message_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 contact_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('sms','email')),
 subject text NOT NULL DEFAULT '' CHECK(length(subject)<=200),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 5000),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','blocked','simulated')),
 block_reason text,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,contact_id) REFERENCES contacts(tenant_id,id) ON DELETE RESTRICT
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('agency_message_drafts'::regclass);
