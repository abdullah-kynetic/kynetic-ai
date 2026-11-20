import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './baseline';

/** Owner-only admin keys. Runtime access goes through the admin_api_key_* functions only. */
export const adminApiKeys = pgTable('admin_api_keys', {
  id: uuid().defaultRandom().primaryKey(),
  prefix: text().notNull().unique(),
  keyHash: text('key_hash').notNull(),
  label: text().notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  allowedCidrs: text('allowed_cidrs')
    .array()
    .notNull()
    .default(sql`'{}'`),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
});

/** One row: the stop-all switch for every service API key. */
export const serviceApiControl = pgTable(
  'service_api_control',
  {
    id: boolean().primaryKey().default(true),
    enabled: boolean().notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'restrict' })
  },
  (t) => [check('service_api_control_id_check', sql`${t.id}`)]
);
