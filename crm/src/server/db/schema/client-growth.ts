import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import { contacts, tenants, users } from './baseline';

/**
 * Client growth tables (Lane A): review requests and client referrals.
 * Quote, nurture and ad-spend tables land here with their own migrations. Every table is tenant
 * scoped with forced RLS and a composite contact foreign key so a row cannot point across tenants.
 */

export const REVIEW_REQUEST_CHANNELS = ['sms', 'email'] as const;
export const REVIEW_REQUEST_STATUSES = ['queued', 'sent', 'completed', 'cancelled'] as const;

/** A review request a client asked us to send. Rows start `queued` and nothing leaves the portal. */
export const reviewRequests = pgTable(
  'review_requests',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    contactId: uuid('contact_id').notNull(),
    channel: text().notNull(),
    status: text().default('queued').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    createdBy: uuid('created_by').references(() => users.id)
  },
  (table) => [
    unique('review_requests_tenant_id_id_key').on(table.tenantId, table.id),
    index('review_requests_tenant_requested_idx').on(table.tenantId, table.requestedAt),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [contacts.tenantId, contacts.id]
    }).onDelete('restrict'),
    check(
      'review_requests_channel_check',
      sql`${table.channel} IN ('sms', 'email')`
    ),
    check(
      'review_requests_status_check',
      sql`${table.status} IN ('queued', 'sent', 'completed', 'cancelled')`
    )
  ]
);

/** One client-to-client referral. Rewards are edited by the owner only. */
export const clientReferrals = pgTable(
  'client_referrals',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    referrerContactId: uuid('referrer_contact_id').notNull(),
    refereeContactId: uuid('referee_contact_id'),
    refereeName: text('referee_name').notNull(),
    refereePhone: text('referee_phone'),
    status: text().default('new').notNull(),
    rewardCents: integer('reward_cents').default(0).notNull(),
    rewardStatus: text('reward_status').default('none').notNull(),
    notes: text().default('').notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (table) => [
    unique('client_referrals_tenant_id_id_key').on(table.tenantId, table.id),
    index('client_referrals_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('client_referrals_tenant_status_idx').on(table.tenantId, table.status),
    foreignKey({
      columns: [table.tenantId, table.referrerContactId],
      foreignColumns: [contacts.tenantId, contacts.id]
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.refereeContactId],
      foreignColumns: [contacts.tenantId, contacts.id]
    }).onDelete('set null'),
    check(
      'client_referrals_status_check',
      sql`${table.status} IN ('new', 'contacted', 'booked', 'won', 'lost')`
    ),
    check(
      'client_referrals_reward_status_check',
      sql`${table.rewardStatus} IN ('none', 'pending', 'paid')`
    ),
    check('client_referrals_reward_cents_check', sql`${table.rewardCents} >= 0`),
    check('client_referrals_referee_name_check', sql`length(btrim(${table.refereeName})) > 0`)
  ]
);

export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type ClientReferral = typeof clientReferrals.$inferSelect;
