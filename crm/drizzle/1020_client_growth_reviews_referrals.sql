-- Lane A batch A1: review requests and client referrals. Neither table sends anything; review
-- requests stay queued while outbound messaging is off (P-A3).
CREATE TABLE review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'completed', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES users(id),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX review_requests_tenant_requested_idx
  ON review_requests (tenant_id, requested_at DESC);
--> statement-breakpoint
SELECT app_enable_tenant_rls('review_requests'::regclass);
--> statement-breakpoint
-- Requests are a queue record. Staff see and add them; nothing in the portal edits or removes them.
REVOKE UPDATE, DELETE ON review_requests FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
CREATE TABLE client_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  referrer_contact_id uuid NOT NULL,
  referee_contact_id uuid,
  referee_name text NOT NULL CHECK (length(btrim(referee_name)) > 0),
  referee_phone text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'booked', 'won', 'lost')),
  reward_cents integer NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  reward_status text NOT NULL DEFAULT 'none'
    CHECK (reward_status IN ('none', 'pending', 'paid')),
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, referrer_contact_id) REFERENCES contacts (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, referee_contact_id) REFERENCES contacts (tenant_id, id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX client_referrals_tenant_created_idx
  ON client_referrals (tenant_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX client_referrals_tenant_status_idx
  ON client_referrals (tenant_id, status);
--> statement-breakpoint
SELECT app_enable_tenant_rls('client_referrals'::regclass);
