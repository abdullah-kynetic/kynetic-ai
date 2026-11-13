import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants, users } from './baseline';

export const CALL_TAGS = [
  'booked',
  'qualified',
  'not_interested',
  'voicemail',
  'no_answer',
  'transferred',
  'callback_requested',
  'wrong_number',
  'asked_to_stop',
  'other'
] as const;
export type CallTag = (typeof CALL_TAGS)[number];

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const callAiSummaries = pgTable(
  'call_ai_summaries',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    callId: uuid('call_id').notNull(),
    summary: text().notNull(),
    outcomeTag: text('outcome_tag').notNull(),
    auditId: uuid('audit_id').notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: ts('created_at').defaultNow().notNull()
  },
  (t) => [
    unique('call_ai_summaries_tenant_id_id_key').on(t.tenantId, t.id),
    unique('call_ai_summaries_tenant_id_call_id_key').on(t.tenantId, t.callId)
  ]
);

export const aiMessageDrafts = pgTable(
  'ai_message_drafts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    contactId: uuid('contact_id').notNull(),
    channel: text().notNull(),
    purpose: text().notNull(),
    subject: text(),
    body: text().notNull(),
    status: text().default('draft').notNull(),
    blockedMessage: text('blocked_message'),
    sentMessageId: uuid('sent_message_id'),
    auditId: uuid('audit_id').notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: ts('created_at').defaultNow().notNull()
  },
  (t) => [
    unique('ai_message_drafts_tenant_id_id_key').on(t.tenantId, t.id),
    index('ai_message_drafts_contact_idx').on(t.tenantId, t.contactId, t.createdAt.desc()),
    check('ai_message_drafts_channel_check', sql`${t.channel} IN ('sms', 'email')`)
  ]
);

export const leadBriefs = pgTable(
  'lead_briefs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    contactId: uuid('contact_id').notNull(),
    headline: text().notNull(),
    auditId: uuid('audit_id').notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: ts('created_at').defaultNow().notNull()
  },
  (t) => [
    unique('lead_briefs_tenant_id_id_key').on(t.tenantId, t.id),
    index('lead_briefs_contact_idx').on(t.tenantId, t.contactId, t.createdAt.desc())
  ]
);

export const leadBriefFacts = pgTable(
  'lead_brief_facts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    briefId: uuid('brief_id').notNull(),
    claim: text().notNull(),
    evidenceQuote: text('evidence_quote'),
    sourceId: text('source_id'),
    strength: text().notNull(),
    status: text().notNull(),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: ts('decided_at'),
    createdAt: ts('created_at').defaultNow().notNull()
  },
  (t) => [
    unique('lead_brief_facts_tenant_id_id_key').on(t.tenantId, t.id),
    check('lead_brief_facts_strength_check', sql`${t.strength} IN ('strong', 'weak')`)
  ]
);
