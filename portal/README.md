# Kynetic Client Portal

Client portal for Kynetic AI at **https://portal.kyneticai.com**. Each client signs in and sees only their own business profile, contacts, Plan 1 scope, timeline, documents (download + upload) and a results dashboard (speed-to-lead, calls, bookings, minutes used vs 1,200 included). Two internal admins manage every client. Design and data model: [PLAN.md](PLAN.md).

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind v4 · Postgres 16 + Drizzle · Auth.js v5 · Resend (email) · local disk or Cloudflare R2 (files) · Docker behind the host Caddy.

## Security model (short)

1. **Server-resolved tenant.** Client pages never take a client id from the URL or body. The session carries only a user id; role, client and status are re-read from the DB on every request, so disabling a user or bumping `session_version` takes effect immediately.
2. **Scoped queries.** All data access goes through `withScope()` (`src/lib/db/scoped.ts`) and also filters `client_id` explicitly.
3. **Postgres RLS.** Every client-data table has `client_id` with `FORCE ROW LEVEL SECURITY`. The app connects as `portal_app` (not owner, no BYPASSRLS). With no context set, queries return zero rows.
4. **Admins** need TOTP MFA (enrolment is forced on first login) and get 12-hour sessions.
5. **Files** are served only through `/api/files/:id` with a live session, a short-lived HMAC signature bound to the user and document, and a tenant-scoped lookup. All failures return 404.
6. **Headers:** per-request CSP nonce, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy.
7. Login: Argon2id, lockout after 5 failures, DB-backed rate limits, single-use hashed magic/reset/invite tokens. Clients never see other users' names or emails.

## Local development

```bash
cd portal
npm install
npm run db:dev                    # embedded Postgres on :5433 (leave running)
cp .env.example .env.local        # then set DATABASE_URL / DATABASE_OWNER_URL to the URLs db:dev prints,
                                  # and generate AUTH_SECRET, ENCRYPTION_KEY, FILE_SIGNING_SECRET
set -a; . ./.env.local; set +a
npm run db:migrate
SEED_CLIENT_PASSWORD='choose-a-password' npm run db:seed   # fake "Test Client A/B" only
npx tsx scripts/create-admin.mts you@example.com "You"     # prints an invite link
npx next dev
```

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Runtime connection as `portal_app` |
| `DATABASE_OWNER_URL` | Owner role, used only by migrations, seed, create-admin |
| `APP_URL`, `AUTH_URL` | Public URL (links in emails, Auth.js) |
| `AUTH_SECRET` | Auth.js JWT secret |
| `ENCRYPTION_KEY` | 32-byte base64 AES-GCM key for TOTP secrets |
| `FILE_SIGNING_SECRET` | HMAC key for signed download URLs |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Local file storage path and size limit |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email. **Empty = emails are logged to the server console** (`docker logs portal-portal-app-1`) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2. **Any empty = local disk** is used |

## Tests

```bash
npm test                 # full gate: fresh embedded Postgres, build, start the real app, run every suite
npm run test:isolation   # isolation + RLS only
TEST_SKIP_BUILD=1 npm test   # reuse the last .next-test build
```

Suites: `tests/isolation/*` (client A vs B by id guessing on pages, files, uploads, ingest API, server actions), `tests/rls.test.ts` (direct SQL as `portal_app`), `tests/auth.test.ts`, `tests/headers.test.ts`, `tests/static-guards.test.ts`.

## Deploy

See `deploy/`: `Dockerfile`, `docker-compose.yml` (project `portal`, app on `127.0.0.1:3020`, DB on a private network), `Caddyfile.portal`, `server-bootstrap.sh`, `deploy.sh`, `backup.sh`. Day-to-day admin tasks are in [ADMIN.md](ADMIN.md); n8n integration is in [N8N.md](N8N.md).
