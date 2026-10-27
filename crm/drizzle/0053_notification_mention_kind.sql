-- M3-03 (DC-114): a note @mention notifies the teammate, so notifications.kind gains 'mention'.
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
--> statement-breakpoint
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind = ANY (ARRAY['new_lead'::text, 'booked'::text, 'task_due'::text, 'report_ready'::text, 'action_needed'::text, 'deal_won'::text, 'hot_lead'::text, 'mention'::text]));
