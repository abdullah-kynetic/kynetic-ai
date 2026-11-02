import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './baseline';
export const agencyWorkspaces = pgTable(
  'agency_workspaces',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    workspaceKey: text('workspace_key').notNull().unique('agency_workspaces_workspace_key_key'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    check('agency_workspaces_workspace_key_check', sql`${t.workspaceKey} = 'kynetic_synthetic'`)
  ]
);
