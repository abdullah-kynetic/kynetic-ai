import { sql } from 'drizzle-orm';
import {
  bigint,
  customType,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
  boolean
} from 'drizzle-orm/pg-core';

// Staff-only archive of the Twenty planning records (migration 1021). No tenant id by design.
// Row-level security and grants live in the migration; queries use raw SQL in src/server/archive.
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const archiveNotes = pgTable('archive_notes', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  twentyId: text('twenty_id').notNull().unique(),
  title: text().notNull(),
  body: text().notNull(),
  tag: text().default('general').notNull(),
  superseded: boolean().default(false).notNull(),
  createdOn: date('created_on', { mode: 'string' }).notNull(),
  updatedOn: date('updated_on', { mode: 'string' }),
  search: tsvector().generatedAlwaysAs(
    sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')`
  )
});

export const archiveTasks = pgTable('archive_tasks', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  twentyId: text('twenty_id').notNull().unique(),
  title: text().notNull(),
  body: text().default('').notNull(),
  status: text().notNull(),
  priority: text(),
  step: integer(),
  dueOn: date('due_on', { mode: 'string' }),
  createdOn: date('created_on', { mode: 'string' }).notNull(),
  search: tsvector().generatedAlwaysAs(
    sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))`
  )
});

export const archiveAttachments = pgTable('archive_attachments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  fileName: text('file_name').notNull().unique(),
  description: text().default('').notNull(),
  contentType: text('content_type').default('application/octet-stream').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  fileKey: text('file_key'),
  createdOn: date('created_on', { mode: 'string' })
});

export const archiveRecords = pgTable('archive_records', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  object: text().notNull(),
  twentyId: text('twenty_id').notNull().unique(),
  label: text().notNull(),
  data: jsonb().notNull(),
  createdOn: date('created_on', { mode: 'string' })
});
