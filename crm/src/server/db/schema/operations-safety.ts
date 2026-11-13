import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import { tenants, users } from './baseline';

/** One row. Admin writes go through admin_set_outbound_pause. */
export const platformSettings = pgTable('platform_settings', {
  singleton: boolean().primaryKey().default(true).notNull(),
  outboundPaused: boolean('outbound_paused').default(false).notNull(),
  pausedBy: uuid('paused_by').references(() => users.id),
  pausedAt: timestamp('paused_at', { withTimezone: true, mode: 'string' }),
  reason: text(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
});

/** Nightly (hourly fanout) usage. Costs that are not stored count as 0 and set cost_unknown. */
export const usageDaily = pgTable(
  'usage_daily',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    day: date().notNull(),
    callCount: integer('call_count').default(0).notNull(),
    callSeconds: integer('call_seconds').default(0).notNull(),
    callCostCents: integer('call_cost_cents').default(0).notNull(),
    smsCount: integer('sms_count').default(0).notNull(),
    emailCount: integer('email_count').default(0).notNull(),
    messageCostCents: integer('message_cost_cents').default(0).notNull(),
    costUnknown: boolean('cost_unknown').default(false).notNull(),
    llmCostMicros: bigint('llm_cost_micros', { mode: 'number' }).default(0).notNull()
  },
  (table) => [
    unique('usage_daily_pkey').on(table.tenantId, table.day),
    check('usage_daily_counts_check', sql`${table.callCount} >= 0 AND ${table.callSeconds} >= 0`),
    check(
      'usage_daily_cost_check',
      sql`${table.callCostCents} >= 0 AND ${table.messageCostCents} >= 0`
    )
  ]
);

export const tenantExports = pgTable(
  'tenant_exports',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    storageKey: text('storage_key').notNull(),
    status: text().default('queued').notNull(),
    byteSize: integer('byte_size'),
    error: text(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    readyAt: timestamp('ready_at', { withTimezone: true, mode: 'string' })
  },
  (table) => [
    unique('tenant_exports_tenant_id_key').on(table.tenantId, table.id),
    check('tenant_exports_status_check', sql`${table.status} IN ('queued', 'ready', 'failed')`)
  ]
);

/** In-app notices for Kynetic admins. Not tenant scoped, so client notify() is not used. */
export const staffNotifications = pgTable(
  'staff_notifications',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    kind: text().notNull(),
    title: text().notNull(),
    body: text(),
    link: text(),
    dedupeKey: text('dedupe_key'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (table) => [
    unique('staff_notifications_dedupe_key_key').on(table.dedupeKey),
    check(
      'staff_notifications_kind_check',
      sql`${table.kind} IN ('job_failed', 'daily_digest', 'spend_cap', 'ops_alert')`
    )
  ]
);

/** One row per model call, append-only. Cost is in millionths of a dollar. */
export const llmUsage = pgTable(
  'llm_usage',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    task: text().notNull(),
    model: text().notNull(),
    status: text().default('ok').notNull(),
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    costMicros: bigint('cost_micros', { mode: 'number' }).default(0).notNull(),
    costKnown: boolean('cost_known').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (table) => [
    unique('llm_usage_tenant_id_id_key').on(table.tenantId, table.id),
    index('llm_usage_tenant_created_idx').on(table.tenantId, table.createdAt.desc()),
    check(
      'llm_usage_task_check',
      sql`${table.task} IN ('call_summary', 'message_draft', 'lead_brief')`
    ),
    check('llm_usage_status_check', sql`${table.status} IN ('ok', 'failed')`)
  ]
);
