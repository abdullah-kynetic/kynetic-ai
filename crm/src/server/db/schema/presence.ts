import { date, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './baseline';

export const presenceItems = pgTable('presence_items', {
  id: uuid().defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  kind: text().notNull(),
  title: text().notNull(),
  status: text().notNull().default('planned'),
  notes: text().notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
}, (t) => [unique('presence_items_tenant_id_id_key').on(t.tenantId, t.id), index('presence_items_tenant_idx').on(t.tenantId, t.updatedAt)]);

export const reviewSnapshots = pgTable('review_snapshots', {
  id: uuid().defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  source: text().notNull(),
  capturedOn: date('captured_on').notNull(),
  reviewCount: integer('review_count').notNull(),
  averageRating: numeric('average_rating', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
}, (t) => [unique('review_snapshots_tenant_id_source_captured_on_key').on(t.tenantId, t.source, t.capturedOn)]);
