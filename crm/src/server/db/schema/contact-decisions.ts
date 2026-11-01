import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import { contacts, tenants } from './baseline';

/** M12-03: immutable request ledger; runtime grants allow SELECT and INSERT only. */
export const contactDecisions = pgTable(
  'contact_decisions',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id').notNull(),
    contactId: uuid('contact_id').notNull(),
    payload: jsonb().notNull(),
    payloadHash: text('payload_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique('contact_decisions_tenant_id_event_id_key').on(t.tenantId, t.eventId),
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [contacts.tenantId, contacts.id],
      name: 'contact_decisions_tenant_id_contact_id_fkey'
    }).onDelete('restrict'),
    check('contact_decisions_payload_check', sql`jsonb_typeof(${t.payload}) = 'object'`),
    check('contact_decisions_payload_hash_check', sql`${t.payloadHash} ~ '^[0-9a-f]{64}$'`)
  ]
);
