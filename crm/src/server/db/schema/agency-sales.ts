import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import { agencyWorkspaces } from './agency';
import { contacts, deals, tenants, users } from './baseline';

export const agencyContracts = pgTable(
  'agency_contracts',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    dealId: uuid('deal_id').notNull(),
    title: text().notNull(),
    status: text().notNull().default('draft'),
    sentOn: date('sent_on'),
    signedOn: date('signed_on'),
    notes: text().notNull().default(''),
    signedFileKey: text('signed_file_key'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique('agency_contracts_tenant_id_id_key').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.dealId],
      foreignColumns: [deals.tenantId, deals.id]
    }).onDelete('restrict'),
    check('agency_contracts_title_check', sql`length(btrim(${t.title})) between 1 and 200`),
    check('agency_contracts_status_check', sql`${t.status} in ('draft','sent','signed','void')`),
    check('agency_contracts_notes_check', sql`length(${t.notes}) <= 2000`)
  ]
);

export const agencyExpenses = pgTable(
  'agency_expenses',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    spentOn: date('spent_on').notNull(),
    vendor: text().notNull(),
    category: text().notNull(),
    amountCents: integer('amount_cents').notNull(),
    note: text().notNull().default(''),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' })
  },
  (t) => [
    check('agency_expenses_vendor_check', sql`length(btrim(${t.vendor})) between 1 and 200`),
    check('agency_expenses_category_check', sql`length(btrim(${t.category})) between 1 and 80`),
    check('agency_expenses_amount_cents_check', sql`${t.amountCents} >= 0`),
    check('agency_expenses_note_check', sql`length(${t.note}) <= 2000`)
  ]
);

export const agencyRevenueEntries = pgTable(
  'agency_revenue_entries',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    dealId: uuid('deal_id'),
    receivedOn: date('received_on').notNull(),
    amountCents: integer('amount_cents').notNull(),
    note: text().notNull().default(''),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' })
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.dealId],
      foreignColumns: [deals.tenantId, deals.id]
    }).onDelete('restrict'),
    check('agency_revenue_entries_amount_cents_check', sql`${t.amountCents} > 0`),
    check('agency_revenue_entries_note_check', sql`length(${t.note}) <= 2000`)
  ]
);

export const agencyReferrals = pgTable(
  'agency_referrals',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    referrerName: text('referrer_name').notNull(),
    contactId: uuid('contact_id'),
    status: text().notNull().default('new'),
    rewardNote: text('reward_note').notNull().default(''),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'string' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id]
    }).onDelete('restrict'),
    check(
      'agency_referrals_referrer_name_check',
      sql`length(btrim(${t.referrerName})) between 1 and 200`
    ),
    check('agency_referrals_status_check', sql`${t.status} in ('new','approved','declined')`),
    check('agency_referrals_reward_note_check', sql`length(${t.rewardNote}) <= 2000`)
  ]
);

export const agencyCaseStudies = pgTable(
  'agency_case_studies',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    clientTenantId: uuid('client_tenant_id').references(() => tenants.id, { onDelete: 'restrict' }),
    status: text().notNull().default('idea'),
    url: text(),
    note: text().notNull().default(''),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    check(
      'agency_case_studies_status_check',
      sql`${t.status} in ('idea','drafting','approved','published')`
    ),
    check(
      'agency_case_studies_url_check',
      sql`${t.url} is null or length(${t.url}) between 1 and 500`
    ),
    check('agency_case_studies_note_check', sql`length(${t.note}) <= 2000`)
  ]
);
