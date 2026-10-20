# Kynetic Client Portal — Plan

Target: https://portal.kyneticai.com · Branch `portal` · Folder `/portal` of `abdullah-kynetic/kynetic-ai`.

## 1. Architecture

```
Browser ──HTTPS──> Caddy (host, :443) ──> 127.0.0.1:3020 portal-app (Next.js 16, Node 22, standalone)
                                                │
                                                ├── portal-db (postgres:16-alpine, private docker network, no host port)
                                                └── /data/uploads volume (local storage driver until R2 keys exist)
n8n ──POST /api/ingest/results (Bearer ingest key)──> portal-app
```

- **Next.js 16 App Router + TypeScript + Tailwind v4 + shadcn-style components** (hand-written in `src/components/ui`, no CLI needed). Dark-first.
- **Postgres** in its own container (`/opt/portal`), database `portal`. Twenty's `twenty-db-1` is never touched.
  - Two roles: `portal_owner` (owns tables, runs migrations) and `portal_app` (runtime; NOT owner, NO BYPASSRLS).
- **Drizzle ORM**, SQL migrations in `drizzle/`, applied by `scripts/migrate.ts` as `portal_owner`.
- **Auth.js v5 (next-auth beta)**, JWT session strategy, two Credentials providers:
  - `password` — email + password (+ TOTP code for admins).
  - `magic` — single-use emailed token (+ TOTP for admins).
  - The JWT only carries `uid` + `sv` (session version). On every request `getSession()` re-reads the user from the DB (active? role? client_id? session_version matches?) — so disabling a user or changing their client takes effect immediately. Role/client are never trusted from the token.
  - Argon2id password hashes, lockout + DB-backed rate limiting per IP and per email, single-use hashed tokens (magic/reset/invite) with expiry, secure cookies (`__Secure-` prefix in prod).
  - Admins without TOTP enrolled are forced to `/mfa/setup` and cannot reach admin routes until enrolled; once enrolled, login requires the code.
- **Email**: `src/lib/email.ts` — Resend when `RESEND_API_KEY` is set, otherwise logs to console (links redacted to path in logs? no — full link logged in dev only; prod logs subject+recipient+link so admins can hand-deliver until Resend is set).
- **Files**: `src/lib/storage/` interface `{ put, get, remove }` with `LocalDiskStorage` (default) and `R2Storage` (S3 SDK, used when `R2_*` env vars exist). Files are stored under opaque keys (`<clientId>/<uuid>`), never served statically. Download = `/api/files/:id?exp&sig` — HMAC signature bound to user id + doc id + expiry, AND session check AND client-scoped lookup.

## 2. Tenant isolation (defence in depth)

1. **Route layer** — client pages never take a client id from URL/body; they use `session.clientId`. Admin routes require `role=admin` + MFA.
2. **Query layer** — all data access goes through `withScope(scope, fn)` (`src/lib/db/scoped.ts`), which opens a transaction and sets `app.role`, `app.client_id`, `app.user_id` via `set_config(..., true)` (transaction-local), and every client query also filters `client_id = scope.clientId` explicitly.
3. **Database layer (RLS)** — every client-data table has `client_id` + `ENABLE` + `FORCE ROW LEVEL SECURITY` with policy:
   `client_id = current_setting('app.client_id', true)::uuid OR current_setting('app.role', true) = 'admin'`.
   Unset context ⇒ zero rows. Auth lookups (login by email) use a narrow `system` scope that only touches `users`/`auth_tokens`/`rate_limits`.
4. **Response layer** — not-found and forbidden both return 404 for cross-tenant IDs (no existence oracle). Clients never receive member lists, other users' names/emails, or uploader identities (uploads show "Kynetic" or "You").

## 3. Data model (all ids uuid)

| table | key columns |
|---|---|
| clients | name, slug, status(onboarding/active/paused), plan_name, included_minutes(1200), twenty_company_id |
| business_profiles | client_id PK, legal_name, industry, website, phone, address, service_area, hours, notes |
| contacts | client_id, name, title, email, phone, is_primary |
| scope_items | client_id, title, description, status(planned/in_progress/done), sort |
| milestones | client_id, phase(kickoff/build/testing/go_live), title, description, due_date, status(upcoming/in_progress/done), completed_at, sort |
| documents | client_id, name, category, storage_key, mime, size, uploaded_by(user), uploaded_by_role, created_at |
| daily_results | client_id, date, leads, calls, bookings, minutes_used, avg_speed_to_lead_sec; UNIQUE(client_id,date) |
| ingest_keys | client_id, prefix, key_hash(sha256), label, last_used_at, revoked_at |
| users | email UNIQUE, name, role(admin/client), client_id NULL for admin, password_hash, totp_secret_enc, totp_enabled, session_version, failed_logins, locked_until, disabled_at, last_login_at |
| auth_tokens | user_id, type(magic/reset/invite), token_hash, expires_at, used_at |
| rate_limits | key, window_start, count |
| audit_log | actor_user_id, client_id, action, meta jsonb |

## 4. Routes

Public: `/login`, `/login/magic` (request link), `/auth/magic?token=` (consume), `/forgot`, `/reset?token=`, `/invite?token=` (set password).
Client (`/(portal)`): `/` overview · `/profile` · `/contacts` · `/scope` · `/timeline` · `/documents` · `/results`.
Admin (`/admin`): `/admin` clients list · `/admin/clients/new` · `/admin/clients/[id]` with tabs (overview/profile, contacts, scope, timeline, documents, results, users, keys) · `/admin/security` (TOTP).
Account: `/mfa/setup`, `/account` (change password).
API: `/api/auth/*` (Auth.js) · `GET /api/files/[id]` · `POST /api/documents` (upload) · `POST /api/ingest/results` (Bearer ingest key) · `GET /api/health`.

## 5. Ingest API

`POST /api/ingest/results` · `Authorization: Bearer kp_<prefix>_<secret>` · body `{ rows: [{ date, leads, calls, bookings, minutes_used, avg_speed_to_lead_sec }] }` (≤ 400 rows). Key → client resolved server-side; any `client_id` in body is ignored/rejected. Upsert on (client_id, date). Optional `X-Kynetic-Signature: sha256=<hmac(body)>` verified if sent. Rate limited per key.

## 6. Sub-agent split

| Agent | Owns | Depends on |
|---|---|---|
| Lead (me) | PLAN, schema, migrations, RLS, `withScope`, auth core, storage, ingest, integration, deploy, REPORT | — |
| Frontend | `src/app/**` pages + `src/components/**` (client + admin UI), server actions using the lib layer | lib layer |
| Security/QA | `tests/**`: isolation (A vs B by id guessing on pages/files/results/API/actions), auth, RLS direct-SQL tests, headers, `npm audit` | lib + routes |
| Infra | `deploy/**`: Dockerfile, compose, Caddy snippet, backup script + cron, server bootstrap script | app builds |
| Docs | README, ADMIN.md, N8N.md | everything |

Agents edit disjoint folders; I review and integrate each.

## 7. Milestones

1. Foundation: schema + RLS + scoped db + auth core + seed (fake A/B) — local embedded Postgres.
2. UI (client + admin) + upload/download + ingest.
3. Tests green (isolation suite is a deploy gate: `npm run test` must pass inside the Docker build pipeline step before `up`).
4. Infra on VPS: `/opt/portal`, compose up, Caddy block, backups cron.
5. Docs, build report (`docs/build-report-2026-10-16.md`), push branch `portal`.

## 8. Test plan

- **Isolation (gate)**: log in as client A over real HTTP against `next start`; for every B resource id (documents, contacts, milestones, scope items, results rows, ingest keys, users, client id) try: client pages, `/admin/*`, `/api/files/:id` (with and without a valid-looking signature), server actions with B ids, ingest with A's key + `client_id: B`. Expect 403/404/redirect and no B data in any body. Also: unauthenticated access → redirect/401.
- **RLS**: as `portal_app`, query each table with no context (0 rows), with A context (only A), with forged B id in WHERE (0 rows), insert row for B under A context (rejected).
- **Auth**: wrong password, lockout after N failures, rate limit 429, magic link single use + expiry, reset token single use, admin requires TOTP, disabled user's session dies, client cannot reach `/admin`.
- **Headers**: CSP, HSTS, X-Frame-Options/frame-ancestors, nosniff, Referrer-Policy present.
- **Audit**: `npm audit --omit=dev` — no high/critical in runtime deps.
