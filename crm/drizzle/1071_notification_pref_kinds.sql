-- P3-S5: the per-person email setting could not be saved for mention, support_reply or support_request,
-- because the kind check predates them. Same ten kinds as notifications.kind.
ALTER TABLE notification_preferences DROP CONSTRAINT notification_preferences_kind_check;
--> statement-breakpoint
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_kind_check CHECK (
  kind IN ('new_lead','booked','task_due','report_ready','action_needed','deal_won','hot_lead','mention','support_reply','support_request')
);
