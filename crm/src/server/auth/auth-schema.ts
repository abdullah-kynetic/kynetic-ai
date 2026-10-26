import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// The slice of `users` the auth library reads and writes. kynetic_auth holds column grants, and an
// INSERT that lists a column needs that grant even when the value is DEFAULT, so the adapter must not
// see kynetic_role, disabled_at or two_factor_enabled. Deliberately not exported from db/schema.
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const authUsers = pgTable('users', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  email: text().notNull(),
  name: text(),
  image: text(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull()
});
