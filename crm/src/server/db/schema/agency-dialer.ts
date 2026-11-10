import { sql } from 'drizzle-orm';
import {
  check,
  jsonb,
  foreignKey,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import { agencyWorkspaces } from './agency';
import { contacts, users } from './baseline';
export const agencyCampaigns = pgTable(
  'agency_campaigns',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    name: text().notNull(),
    script: text().notNull(),
    steps: jsonb()
      .$type<import('../../agency/campaign-policy').CampaignStep[]>()
      .notNull()
      .default([]),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (t) => [
    unique('agency_campaigns_tenant_id_id_key').on(t.tenantId, t.id),
    uniqueIndex('agency_campaigns_name_uq').on(t.tenantId, sql`lower(${t.name})`),
    check('agency_campaigns_name_check', sql`length(btrim(${t.name})) between 1 and 120`),
    check('agency_campaigns_script_check', sql`length(btrim(${t.script})) between 1 and 5000`)
  ]
);
export const agencyCampaignLeads = pgTable(
  'agency_campaign_leads',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    campaignId: uuid('campaign_id').notNull(),
    contactId: uuid('contact_id').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.campaignId, t.contactId] }),
    foreignKey({
      columns: [t.tenantId, t.campaignId],
      foreignColumns: [agencyCampaigns.tenantId, agencyCampaigns.id]
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id]
    }).onDelete('restrict')
  ]
);
export const agencyCallAttempts = pgTable(
  'agency_call_attempts',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    contactId: uuid('contact_id').notNull(),
    eventId: uuid('event_id').notNull(),
    requestHash: text('request_hash').notNull(),
    outcome: text().notNull(),
    notes: text().notNull().default(''),
    loggedBy: uuid('logged_by')
      .notNull()
      .references(() => users.id),
    loggedAt: timestamp('logged_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
  },
  (t) => [
    unique('agency_call_attempts_tenant_id_event_id_key').on(t.tenantId, t.eventId),
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id]
    }).onDelete('restrict'),
    check('agency_call_attempts_request_hash_check', sql`${t.requestHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'agency_call_attempts_outcome_check',
      sql`${t.outcome} in ('no_answer','voicemail','connected','interested','not_interested','callback','dnc')`
    ),
    check('agency_call_attempts_notes_check', sql`length(${t.notes}) <= 1000`)
  ]
);
