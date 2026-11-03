-- M17-01: internal drafts only. No send state, public access or provider integration.
CREATE TABLE agency_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
  deal_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  problem text NOT NULL DEFAULT '' CHECK (length(problem) <= 6000),
  solution text NOT NULL DEFAULT '' CHECK (length(solution) <= 6000),
  roadmap text NOT NULL DEFAULT '' CHECK (length(roadmap) <= 6000),
  roi text NOT NULL DEFAULT '' CHECK (length(roi) <= 6000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, deal_id),
  FOREIGN KEY (tenant_id, deal_id) REFERENCES deals(tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('agency_proposals'::regclass);
--> statement-breakpoint
REVOKE DELETE ON agency_proposals FROM kynetic_app, kynetic_worker;
