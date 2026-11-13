-- P4-S5: monitoring alert rules (dead worker, failed backups, disk, queue) record an in-app staff notice
-- of a new kind, 'ops_alert'. Same function, same owner, same grants; only the allowed kinds grow.
ALTER TABLE staff_notifications DROP CONSTRAINT staff_notifications_kind_check;
--> statement-breakpoint
ALTER TABLE staff_notifications ADD CONSTRAINT staff_notifications_kind_check
  CHECK (kind IN ('job_failed', 'daily_digest', 'spend_cap', 'ops_alert'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION record_staff_notification(
  p_kind text, p_title text, p_body text, p_link text, p_dedupe_key text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_link text;
BEGIN
  IF session_user = 'kynetic_app' AND app_role() IS DISTINCT FROM 'admin' AND app_role() IS DISTINCT FROM 'system' THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('job_failed', 'daily_digest', 'spend_cap', 'ops_alert') THEN
    RAISE EXCEPTION 'unknown notification kind' USING ERRCODE = '22023';
  END IF;
  v_link := NULLIF(p_link, '');
  IF v_link IS NOT NULL AND (v_link NOT LIKE '/%' OR v_link LIKE '//%') THEN
    v_link := NULL;
  END IF;
  INSERT INTO staff_notifications (kind, title, body, link, dedupe_key)
  VALUES (p_kind, left(btrim(p_title), 200), left(p_body, 4000), v_link, NULLIF(p_dedupe_key, ''))
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
