import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import { agencyWorkspaces } from './agency';
import { agencyCampaignLeads } from './agency-dialer';
import { contacts, deals, users } from './baseline';

export const agencyAlerts = pgTable(
  'agency_alerts',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    kind: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    eventKey: text('event_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique('agency_alerts_tenant_id_event_key_key').on(t.tenantId, t.eventKey),
    check('agency_alerts_kind_check', sql`${t.kind} in ('new_lead','daily_digest')`)
  ]
);

export const agencyDmLogs = pgTable(
  'agency_dm_logs',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    contactId: uuid('contact_id').notNull(),
    direction: text().notNull(),
    platform: text().notNull(),
    body: text().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    loggedBy: uuid('logged_by')
      .notNull()
      .references(() => users.id)
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id]
    }).onDelete('restrict'),
    check('agency_dm_logs_direction_check', sql`${t.direction} in ('inbound','outbound')`),
    check('agency_dm_logs_platform_check', sql`length(btrim(${t.platform})) between 1 and 80`),
    check('agency_dm_logs_body_check', sql`length(btrim(${t.body})) between 1 and 5000`)
  ]
);

export const agencyMessageDrafts = pgTable(
  'agency_message_drafts',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    contactId: uuid('contact_id').notNull(),
    channel: text().notNull(),
    subject: text().notNull().default(''),
    body: text().notNull(),
    status: text().notNull().default('draft'),
    blockReason: text('block_reason'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id]
    }).onDelete('restrict'),
    check('agency_message_drafts_channel_check', sql`${t.channel} in ('sms','email')`),
    check('agency_message_drafts_subject_check', sql`length(${t.subject}) <= 200`),
    check('agency_message_drafts_body_check', sql`length(btrim(${t.body})) between 1 and 5000`),
    check('agency_message_drafts_status_check', sql`${t.status} in ('draft','blocked','simulated')`)
  ]
);

export const agencyCampaignProgress = pgTable(
  'agency_campaign_progress',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    campaignId: uuid('campaign_id').notNull(),
    contactId: uuid('contact_id').notNull(),
    stepIndex: integer('step_index').notNull().default(0),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'string' }).notNull(),
    state: text().notNull().default('active'),
    stopReason: text('stop_reason'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.campaignId, t.contactId] }),
    foreignKey({
      columns: [t.tenantId, t.campaignId, t.contactId],
      foreignColumns: [
        agencyCampaignLeads.tenantId,
        agencyCampaignLeads.campaignId,
        agencyCampaignLeads.contactId
      ]
    }).onDelete('restrict'),
    check('agency_campaign_progress_step_index_check', sql`${t.stepIndex} >= 0`),
    check(
      'agency_campaign_progress_state_check',
      sql`${t.state} in ('active','stopped','complete')`
    )
  ]
);

export const agencyCampaignHistory = pgTable(
  'agency_campaign_history',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    campaignId: uuid('campaign_id').notNull(),
    contactId: uuid('contact_id').notNull(),
    stepIndex: integer('step_index').notNull(),
    channel: text().notNull(),
    result: text().notNull(),
    recordedBy: uuid('recorded_by').references(() => users.id),
    note: text(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.campaignId, t.contactId],
      foreignColumns: [
        agencyCampaignProgress.tenantId,
        agencyCampaignProgress.campaignId,
        agencyCampaignProgress.contactId
      ]
    }).onDelete('restrict'),
    check('agency_campaign_history_step_index_check', sql`${t.stepIndex} >= 0`),
    check(
      'agency_campaign_history_channel_check',
      sql`${t.channel} in ('call','sms','email','dm')`
    ),
    check(
      'agency_campaign_history_result_check',
      sql`${t.result} in ('simulated','manual_complete','done','skipped','rescheduled')`
    )
  ]
);

export const agencyOpsSettings = pgTable(
  'agency_ops_settings',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    devWebhookUrl: text('dev_webhook_url').notNull(),
    workflowName: text('workflow_name').notNull(),
    workflowId: text('workflow_id').notNull(),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    check('agency_ops_settings_workflow_name_check', sql`${t.workflowName} like 'DEV - %'`),
    check('agency_ops_settings_workflow_id_check', sql`${t.workflowId} ~ '^[A-Za-z0-9_-]{1,80}$'`)
  ]
);

export const agencyDealTerms = pgTable(
  'agency_deal_terms',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    dealId: uuid('deal_id').notNull(),
    currency: text().notNull(),
    setupCents: integer('setup_cents').notNull(),
    monthlyCents: integer('monthly_cents'),
    installments: jsonb().notNull(),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.dealId] }),
    foreignKey({
      columns: [t.tenantId, t.dealId],
      foreignColumns: [deals.tenantId, deals.id]
    }).onDelete('restrict'),
    check('agency_deal_terms_currency_check', sql`${t.currency} = 'USD'`),
    check('agency_deal_terms_setup_cents_check', sql`${t.setupCents} >= 0`),
    check('agency_deal_terms_monthly_cents_check', sql`${t.monthlyCents} > 0`),
    check('agency_deal_terms_installments_check', sql`jsonb_typeof(${t.installments}) = 'array'`)
  ]
);

export const agencyInvoiceDrafts = pgTable(
  'agency_invoice_drafts',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    dealId: uuid('deal_id').notNull(),
    cycleKey: text('cycle_key').notNull(),
    termsHash: text('terms_hash').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text().notNull(),
    dueOn: date('due_on').notNull(),
    status: text().notNull().default('draft'),
    provider: text().notNull().default('stub'),
    lastEventCreated: bigint('last_event_created', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique('agency_invoice_drafts_tenant_id_id_key').on(t.tenantId, t.id),
    unique('agency_invoice_drafts_tenant_id_deal_id_cycle_key_key').on(
      t.tenantId,
      t.dealId,
      t.cycleKey
    ),
    foreignKey({
      columns: [t.tenantId, t.dealId],
      foreignColumns: [agencyDealTerms.tenantId, agencyDealTerms.dealId]
    }).onDelete('restrict'),
    check('agency_invoice_drafts_terms_hash_check', sql`${t.termsHash} ~ '^[0-9a-f]{64}$'`),
    check('agency_invoice_drafts_amount_cents_check', sql`${t.amountCents} > 0`),
    check('agency_invoice_drafts_currency_check', sql`${t.currency} = 'USD'`),
    check(
      'agency_invoice_drafts_status_check',
      sql`${t.status} in ('draft','open','paid','past_due')`
    ),
    check('agency_invoice_drafts_provider_check', sql`${t.provider} = 'stub'`)
  ]
);

export const agencyBillingEvents = pgTable(
  'agency_billing_events',
  {
    tenantId: uuid('tenant_id').notNull(),
    eventId: text('event_id').notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    payloadHash: text('payload_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.eventId] }),
    foreignKey({
      columns: [t.tenantId, t.invoiceId],
      foreignColumns: [agencyInvoiceDrafts.tenantId, agencyInvoiceDrafts.id]
    }).onDelete('restrict'),
    check('agency_billing_events_payload_hash_check', sql`${t.payloadHash} ~ '^[0-9a-f]{64}$'`)
  ]
);

export const agencyDunningDrafts = pgTable(
  'agency_dunning_drafts',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    day: date('day').notNull(),
    body: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique('agency_dunning_drafts_tenant_id_invoice_id_day_key').on(t.tenantId, t.invoiceId, t.day),
    foreignKey({
      columns: [t.tenantId, t.invoiceId],
      foreignColumns: [agencyInvoiceDrafts.tenantId, agencyInvoiceDrafts.id]
    }).onDelete('restrict')
  ]
);
