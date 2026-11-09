import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
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
    updatedAt: ts('updated_at').defaultNow().notNull(),
    /** Set once a staff member passes TOTP on this session (M0-12). */
    twoFactorVerifiedAt: ts('two_factor_verified_at')
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

// Two-factor secret (M0-12, F-98). The secret is encrypted by the library. backup_codes stays
// because the plugin requires the column; enrolment stores an empty list and codes are not accepted.
export const twoFactors = pgTable('two_factors', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  secret: text().notNull(),
  backupCodes: text('backup_codes').notNull(),
  verified: boolean().default(true).notNull(),
  failedVerificationCount: integer('failed_verification_count').default(0).notNull(),
  lockedUntil: ts('locked_until')
});

// Fixed-window counters for the Postgres rate limiter (M0-21, SECURITY 5.4). Global, no tenant_id.
// `key` is a rule name plus a hash of the subject, so no IP or email is stored.
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text().notNull(),
    windowStart: ts('window_start').notNull(),
    count: integer().notNull().default(0),
    expiresAt: ts('expires_at').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    index('rate_limits_expires_idx').on(t.expiresAt)
  ]
);
