import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import { tenants, users } from './baseline';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const automationVersions = pgTable(
  'automation_versions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    automationId: uuid('automation_id').notNull(),
    version: integer().notNull(),
    steps: jsonb().notNull(),
    status: text().notNull(),
    proposedBy: uuid('proposed_by').references(() => users.id),
    proposedAt: ts('proposed_at').defaultNow().notNull(),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: ts('decided_at'),
    decisionNote: text('decision_note')
  },
  (t) => [
    unique('automation_versions_tenant_id_id_key').on(t.tenantId, t.id),
    unique('automation_versions_automation_id_version_key').on(t.automationId, t.version),
    uniqueIndex('automation_versions_one_pending')
      .on(t.automationId)
      .where(sql`status = 'pending'`),
    check(
      'automation_versions_status_check',
      sql`${t.status} IN ('pending', 'approved', 'rejected', 'superseded')`
    )
  ]
);
