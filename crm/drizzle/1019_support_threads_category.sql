-- Batch 2: support threads and a request category. Messages stay in the portal.
-- No email, call, or text is sent from this migration.
ALTER TABLE support_requests
  ADD COLUMN category text NOT NULL DEFAULT 'general'
  CHECK (category IN ('general', 'alex_change', 'system_request'));
--> statement-breakpoint
ALTER TABLE terms_acceptances ADD COLUMN user_agent text;
--> statement-breakpoint
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
--> statement-breakpoint
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind = ANY (ARRAY[
    'new_lead'::text, 'booked'::text, 'task_due'::text, 'report_ready'::text,
    'action_needed'::text, 'deal_won'::text, 'hot_lead'::text, 'mention'::text,
    'support_reply'::text, 'support_request'::text
  ])
);
--> statement-breakpoint
CREATE TABLE support_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES users(id),
  author_side text NOT NULL CHECK (author_side IN ('client', 'kynetic')),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, request_id) REFERENCES support_requests (tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX support_request_messages_thread_idx
  ON support_request_messages (tenant_id, request_id, created_at);
--> statement-breakpoint
SELECT app_enable_tenant_rls('support_request_messages'::regclass);
--> statement-breakpoint
REVOKE UPDATE, DELETE ON support_request_messages FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
-- A client can only write a message as themselves, on the client side. Staff replies go through
-- the rollup function below, which runs as kynetic_rollup.
CREATE FUNCTION support_message_author_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('kynetic_app', 'kynetic_worker') THEN
    IF NEW.author_side <> 'client'
      OR (app_user_id() IS NOT NULL AND NEW.author_user_id IS DISTINCT FROM app_user_id()) THEN
      RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER support_message_author_guard
  BEFORE INSERT ON support_request_messages
  FOR EACH ROW EXECUTE FUNCTION support_message_author_guard();
--> statement-breakpoint
SET ROLE kynetic_rollup;
--> statement-breakpoint
DROP FUNCTION admin_list_support_requests();
--> statement-breakpoint
RESET ROLE;
--> statement-breakpoint
CREATE FUNCTION admin_list_support_requests(p_category text DEFAULT NULL) RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  subject text,
  body text,
  status text,
  category text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  submitted_by uuid
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  IF p_category IS NOT NULL AND p_category NOT IN ('general', 'alex_change', 'system_request') THEN
    RAISE EXCEPTION 'invalid category' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT s.id, s.tenant_id, t.name, s.subject, s.body, s.status, s.category,
           s.created_at, s.updated_at, s.resolved_at, s.submitted_by
    FROM support_requests s JOIN tenants t ON t.id = s.tenant_id
    WHERE p_category IS NULL OR s.category = p_category
    ORDER BY (s.status = 'resolved'), s.created_at DESC
    LIMIT 200;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_get_support_thread(p_id uuid) RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  subject text,
  body text,
  status text,
  category text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  submitted_by uuid,
  messages jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tenant uuid;
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  SELECT s.tenant_id INTO v_tenant FROM support_requests s WHERE s.id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM rollup_audit(v_tenant, 'support.view', 'support_request', p_id::text, NULL,
    jsonb_build_object('scope', 'thread'));
  RETURN QUERY
    SELECT s.id, s.tenant_id, t.name, s.subject, s.body, s.status, s.category,
           s.created_at, s.updated_at, s.resolved_at, s.submitted_by,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'id', m.id,
               'authorUserId', m.author_user_id,
               'authorSide', m.author_side,
               'body', m.body,
               'createdAt', m.created_at
             ) ORDER BY m.created_at)
             FROM support_request_messages m
             WHERE m.request_id = s.id AND m.tenant_id = s.tenant_id
           ), '[]'::jsonb)
    FROM support_requests s JOIN tenants t ON t.id = s.tenant_id
    WHERE s.id = p_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_reply_support_request(p_id uuid, p_body text)
RETURNS TABLE (message_id uuid, tenant_id uuid, submitted_by uuid, request_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tenant uuid;
  v_owner uuid;
  v_id uuid;
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  IF app_impersonator_id() IS NOT NULL OR app_read_only() THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  IF p_body IS NULL OR length(btrim(p_body)) < 1 OR length(btrim(p_body)) > 5000 THEN
    RAISE EXCEPTION 'invalid body' USING ERRCODE = '22023';
  END IF;
  SELECT s.tenant_id, s.submitted_by INTO v_tenant, v_owner
    FROM support_requests s WHERE s.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO support_request_messages (tenant_id, request_id, author_user_id, author_side, body)
    VALUES (v_tenant, p_id, app_user_id(), 'kynetic', btrim(p_body))
    RETURNING support_request_messages.id INTO v_id;
  UPDATE support_requests SET updated_at = now() WHERE id = p_id;
  PERFORM rollup_audit(v_tenant, 'support.reply', 'support_request', p_id::text, NULL,
    jsonb_build_object('side', 'kynetic', 'messageId', v_id));
  message_id := v_id;
  tenant_id := v_tenant;
  submitted_by := v_owner;
  request_id := p_id;
  RETURN NEXT;
END $$;
--> statement-breakpoint
CREATE FUNCTION admin_list_support_alerts() RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  title text,
  body text,
  link text,
  created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM rollup_require_role('admin', 'va');
  RETURN QUERY
    SELECT n.id, n.tenant_id, t.name, n.title, n.body, n.link, n.created_at
    FROM notifications n JOIN tenants t ON t.id = n.tenant_id
    WHERE n.kind = 'support_request' AND n.read_at IS NULL
    ORDER BY n.created_at DESC
    LIMIT 20;
END $$;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_list_support_requests(text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_get_support_thread(uuid) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_reply_support_request(uuid, text) OWNER TO kynetic_rollup;
--> statement-breakpoint
ALTER FUNCTION admin_list_support_alerts() OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
GRANT SELECT ON notifications TO kynetic_rollup;
--> statement-breakpoint
GRANT SELECT, INSERT ON support_request_messages TO kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION
  admin_list_support_requests(text),
  admin_get_support_thread(uuid),
  admin_reply_support_request(uuid, text),
  admin_list_support_alerts()
FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  admin_list_support_requests(text),
  admin_get_support_thread(uuid),
  admin_reply_support_request(uuid, text),
  admin_list_support_alerts()
TO kynetic_app;
