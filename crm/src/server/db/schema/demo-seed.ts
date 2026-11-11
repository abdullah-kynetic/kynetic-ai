import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './baseline';

/** Synthetic demo rows and before-images used by the reversible demo-client seed. */
export const demoSeedRecords = pgTable(
  'demo_seed_records',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    tableName: text('table_name').notNull(),
    recordId: uuid('record_id').notNull(),
    seedBatch: text('seed_batch').notNull(),
    before: jsonb(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.tableName, table.recordId, table.seedBatch] }),
    index('demo_seed_records_batch_idx').on(table.seedBatch, table.tenantId, table.createdAt)
  ]
);
