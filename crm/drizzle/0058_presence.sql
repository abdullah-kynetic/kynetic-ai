-- F-83: tenant-owned status records only; no external vendor integration.
CREATE TABLE presence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('profile','review_site','directory','social_post')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','done','needs_attention')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX presence_items_tenant_idx ON presence_items (tenant_id, updated_at DESC);
--> statement-breakpoint
CREATE TABLE review_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (length(btrim(source)) BETWEEN 1 AND 200),
  captured_on date NOT NULL,
  review_count integer NOT NULL CHECK (review_count >= 0),
  average_rating numeric(3,2) CHECK (average_rating >= 0 AND average_rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, captured_on)
);
--> statement-breakpoint
SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY['presence_items','review_snapshots']::regclass[]) AS t;
