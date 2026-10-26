import { sql } from 'drizzle-orm';
import { check, foreignKey, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './baseline';

// M4-09 (F-30, F-35): addresses that bounced or complained. RLS lives in migration 0019.
export const emailSuppressions = pgTable(
  'email_suppressions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id').notNull(),
    address: text().notNull(),
    reason: text().notNull(),
    providerMessageId: text('provider_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'email_suppressions_tenant_id_fkey'
    }).onDelete('restrict'),
    unique('email_suppressions_tenant_id_address_key').on(t.tenantId, t.address),
    check('email_suppressions_address_check', sql`address = lower(address)`),
    check('email_suppressions_reason_check', sql`reason IN ('bounced','complained')`)
  ]
);
