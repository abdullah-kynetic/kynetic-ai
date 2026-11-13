-- Phase 2: read-only archive of the Twenty planning records (notes, tasks, attachments, records).
-- Agency-level: no tenant_id, so no client can reach a row. Only admin and VA sessions with no tenant
-- context can SELECT; the web and worker roles can never write. The import runs on a connection that
-- bypasses row-level security (DATABASE_URL_SEED), the same way the prospect seed does.
CREATE TABLE archive_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twenty_id text NOT NULL UNIQUE CHECK (length(twenty_id) BETWEEN 1 AND 64),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 500),
  body text NOT NULL,
  tag text NOT NULL DEFAULT 'general' CHECK (length(tag) BETWEEN 1 AND 60),
  superseded boolean NOT NULL DEFAULT false,
  created_on date NOT NULL,
  updated_on date,
  search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED
);
--> statement-breakpoint
CREATE INDEX archive_notes_search_idx ON archive_notes USING gin (search);
--> statement-breakpoint
CREATE INDEX archive_notes_created_idx ON archive_notes (created_on DESC);
--> statement-breakpoint
CREATE TABLE archive_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twenty_id text NOT NULL UNIQUE CHECK (length(twenty_id) BETWEEN 1 AND 64),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 500),
  body text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('DONE','IN_PROGRESS','TODO')),
  priority text CHECK (priority IS NULL OR priority IN ('P1','P2','P3')),
  step integer CHECK (step IS NULL OR step BETWEEN 1 AND 99),
  due_on date,
  created_on date NOT NULL,
  search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED
);
--> statement-breakpoint
CREATE INDEX archive_tasks_search_idx ON archive_tasks USING gin (search);
--> statement-breakpoint
CREATE TABLE archive_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL UNIQUE CHECK (length(btrim(file_name)) BETWEEN 1 AND 255),
  description text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  -- NULL until the file is copied in. Keys live under archive/ and never under a tenant prefix.
  file_key text CHECK (file_key IS NULL OR file_key LIKE 'archive/%'),
  created_on date
);
--> statement-breakpoint
CREATE TABLE archive_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object text NOT NULL CHECK (object IN ('companies','people','opportunities','call_logs','other')),
  twenty_id text NOT NULL UNIQUE CHECK (length(twenty_id) BETWEEN 1 AND 64),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 500),
  data jsonb NOT NULL,
  created_on date
);
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['archive_notes','archive_tasks','archive_attachments','archive_records'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY archive_staff_read ON %I FOR SELECT TO kynetic_app
      USING (app_role() IN ('admin','va') AND app_tenant_id() IS NULL)$p$, t);
    EXECUTE format('REVOKE ALL ON %I FROM kynetic_app, kynetic_worker', t);
    EXECUTE format('GRANT SELECT ON %I TO kynetic_app', t);
  END LOOP;
END $$;
