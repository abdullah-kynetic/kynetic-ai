import { sql } from "drizzle-orm";
import {
  pgTable, uuid, text, integer, boolean, timestamp, date, numeric, jsonb, pgEnum, uniqueIndex, index, bigint,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", ["admin", "client"]);
export const clientStatusEnum = pgEnum("client_status", ["onboarding", "active", "paused"]);
export const phaseEnum = pgEnum("milestone_phase", ["kickoff", "build", "testing", "go_live"]);
export const milestoneStatusEnum = pgEnum("milestone_status", ["upcoming", "in_progress", "done"]);
export const scopeStatusEnum = pgEnum("scope_status", ["planned", "in_progress", "done"]);
export const tokenTypeEnum = pgEnum("auth_token_type", ["magic", "reset", "invite"]);

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const clientRef = () => uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" });

export const clients = pgTable("clients", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: clientStatusEnum("status").notNull().default("onboarding"),
  planName: text("plan_name").notNull().default("Plan 1"),
  includedMinutes: integer("included_minutes").notNull().default(1200),
  twentyCompanyId: text("twenty_company_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const businessProfiles = pgTable("business_profiles", {
  clientId: uuid("client_id").primaryKey().references(() => clients.id, { onDelete: "cascade" }),
  legalName: text("legal_name"),
  industry: text("industry"),
  website: text("website"),
  phone: text("phone"),
  address: text("address"),
  serviceArea: text("service_area"),
  hours: text("hours"),
  notes: text("notes"),
  updatedAt: updatedAt(),
});

export const contacts = pgTable("contacts", {
  id: id(),
  clientId: clientRef(),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("contacts_client_idx").on(t.clientId)]);

export const scopeItems = pgTable("scope_items", {
  id: id(),
  clientId: clientRef(),
  title: text("title").notNull(),
  description: text("description"),
  status: scopeStatusEnum("status").notNull().default("planned"),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("scope_client_idx").on(t.clientId)]);

export const milestones = pgTable("milestones", {
  id: id(),
  clientId: clientRef(),
  phase: phaseEnum("phase").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  status: milestoneStatusEnum("status").notNull().default("upcoming"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("milestones_client_idx").on(t.clientId)]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull(),
  name: text("name"),
  role: roleEnum("role").notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash"),
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpLastStep: bigint("totp_last_step", { mode: "number" }),
  sessionVersion: integer("session_version").notNull().default(1),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
  index("users_client_idx").on(t.clientId),
]);

export const documents = pgTable("documents", {
  id: id(),
  clientId: clientRef(),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedByRole: roleEnum("uploaded_by_role").notNull(),
  createdAt: createdAt(),
}, (t) => [index("documents_client_idx").on(t.clientId)]);

export const dailyResults = pgTable("daily_results", {
  id: id(),
  clientId: clientRef(),
  date: date("date").notNull(),
  leads: integer("leads").notNull().default(0),
  calls: integer("calls").notNull().default(0),
  bookings: integer("bookings").notNull().default(0),
  minutesUsed: numeric("minutes_used", { precision: 10, scale: 2 }).notNull().default("0"),
  avgSpeedToLeadSec: numeric("avg_speed_to_lead_sec", { precision: 10, scale: 2 }),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("daily_results_client_date_uq").on(t.clientId, t.date)]);

export const ingestKeys = pgTable("ingest_keys", {
  id: id(),
  clientId: clientRef(),
  prefix: text("prefix").notNull().unique(),
  keyHash: text("key_hash").notNull(),
  label: text("label").notNull().default("n8n"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("ingest_keys_client_idx").on(t.clientId)]);

export const authTokens = pgTable("auth_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: tokenTypeEnum("type").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const recoveryCodes = pgTable("recovery_codes", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("recovery_codes_user_idx").on(t.userId)]);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorUserId: uuid("actor_user_id"),
  clientId: uuid("client_id"),
  action: text("action").notNull(),
  meta: jsonb("meta"),
  createdAt: createdAt(),
}, (t) => [index("audit_client_idx").on(t.clientId)]);
