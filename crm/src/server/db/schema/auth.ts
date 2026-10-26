import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './baseline';

// Better-Auth tables (M0-10, DC-055). Global: no tenant_id. Only the kynetic_auth role can touch
// them. Property names are the ones Better-Auth expects; column names are ours.
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text().notNull().unique(),
    expiresAt: ts('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: ts('created_at').defaultNow().notNull(),
    updatedAt: ts('updated_at').defaultNow().notNull()
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: text(),
    password: text(),
    createdAt: ts('created_at').defaultNow().notNull(),
    updatedAt: ts('updated_at').defaultNow().notNull()
  },
  (t) => [
    index('accounts_user_idx').on(t.userId),
    unique('accounts_provider_id_account_id_key').on(t.providerId, t.accountId)
  ]
);

export const verifications = pgTable(
  'verifications',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').defaultNow().notNull(),
    updatedAt: ts('updated_at').defaultNow().notNull()
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)]
);
