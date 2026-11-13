-- P5-S6 to S8: what the three model features store. Each row points at the llm_audit row that produced
-- it, so the prompt, answer and approval are always one join away. None of these tables hold consent,
-- DNC or quiet-hours state, and nothing here changes the call or contact rows themselves.

-- Call summaries and outcome tags. Separate from calls.summary / calls.outcome, which the voice
-- provider fills; the model's version never overwrites them.
CREATE TABLE call_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  call_id uuid NOT NULL,
  summary text NOT NULL CHECK (length(btrim(summary)) > 0),
  outcome_tag text NOT NULL CHECK (outcome_tag IN (
    'booked', 'qualified', 'not_interested', 'voicemail', 'no_answer', 'transferred',
    'callback_requested', 'wrong_number', 'asked_to_stop', 'other')),
  audit_id uuid NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, call_id),
  FOREIGN KEY (tenant_id, call_id) REFERENCES calls (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, audit_id) REFERENCES llm_audit (tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('call_ai_summaries'::regclass);
--> statement-breakpoint
-- Message drafts. A draft is only text until a person approves it; sending goes through the outbound gate.
CREATE TABLE ai_message_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  purpose text NOT NULL CHECK (length(btrim(purpose)) > 0),
  subject text,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'blocked', 'sent', 'rejected')),
  blocked_message text,
  sent_message_id uuid,
  audit_id uuid NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, audit_id) REFERENCES llm_audit (tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX ai_message_drafts_contact_idx ON ai_message_drafts (tenant_id, contact_id, created_at DESC);
--> statement-breakpoint
SELECT app_enable_tenant_rls('ai_message_drafts'::regclass);
--> statement-breakpoint
-- Lead research briefs. A fact whose quoted evidence is found word for word in the record is
-- 'applied'. Anything else is 'suggested' and does nothing until a person accepts it.
CREATE TABLE lead_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL,
  headline text NOT NULL,
  audit_id uuid NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, audit_id) REFERENCES llm_audit (tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX lead_briefs_contact_idx ON lead_briefs (tenant_id, contact_id, created_at DESC);
--> statement-breakpoint
SELECT app_enable_tenant_rls('lead_briefs'::regclass);
--> statement-breakpoint
CREATE TABLE lead_brief_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  brief_id uuid NOT NULL,
  claim text NOT NULL CHECK (length(btrim(claim)) > 0),
  evidence_quote text,
  source_id text,
  strength text NOT NULL CHECK (strength IN ('strong', 'weak')),
  status text NOT NULL CHECK (status IN ('applied', 'suggested', 'accepted', 'dismissed')),
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, brief_id) REFERENCES lead_briefs (tenant_id, id) ON DELETE CASCADE,
  CHECK (strength = 'weak' OR status = 'applied'),
  CHECK (strength = 'strong' OR status <> 'applied')
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('lead_brief_facts'::regclass);
