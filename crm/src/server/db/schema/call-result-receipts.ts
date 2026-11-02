import { sql } from 'drizzle-orm';
import { check, foreignKey, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { calls, tenants } from './baseline';

export const callResultReceipts = pgTable(
  'call_result_receipts',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id').notNull(),
    callId: uuid('call_id').notNull(),
    provider: text().notNull(),
    providerCallId: text('provider_call_id').notNull(),
    payloadHash: text('payload_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique('call_result_receipts_tenant_id_event_id_key').on(t.tenantId, t.eventId),
    unique('call_result_receipts_tenant_id_provider_provider_call_id_key').on(
      t.tenantId,
      t.provider,
      t.providerCallId
    ),
    foreignKey({
      columns: [t.tenantId, t.callId],
      foreignColumns: [calls.tenantId, calls.id],
      name: 'call_result_receipts_tenant_id_call_id_fkey'
    }).onDelete('restrict'),
    check('call_result_receipts_provider_check', sql`${t.provider} in ('elevenlabs', 'retell')`),
    check('call_result_receipts_payload_hash_check', sql`${t.payloadHash} ~ '^[0-9a-f]{64}$'`)
  ]
);
