# Portal build report

**URL:** https://portal.kyneticai.com. Built and running on the VPS, but **DNS isn't set yet** (see below).
**Branch:** `portal` in `abdullah-kynetic/kynetic-ai`, folder `/portal`. Not merged, no PR.

## 1. Add this DNS record

| Type | Name | Value |
|---|---|---|
| A | `portal` (portal.kyneticai.com) | `40.160.150.91` |

The Caddy route is already in place; once the record resolves, Caddy issues the TLS certificate on its own (give it a minute). If you use Cloudflare, set the record to DNS-only (grey cloud) until the certificate is issued.

## 2. Admin login steps

1. After DNS resolves, read your invite link: `ssh ubuntu@40.160.150.91 cat /opt/portal/admin-invites.txt` (it's for abduthelegend1@gmail.com, valid 7 days from 2026-10-16; the file is chmod 600).
2. Open the link, choose a password (12+ chars), sign in.
3. You're sent to `/mfa/setup`: scan the QR with an authenticator app and enter the code. Admin pages unlock after that.
4. **Quentin:** I didn't have his email. Run `sudo docker exec portal-portal-app-1 node /app/scripts/create-admin.mjs <email> "Quentin" /tmp/i.txt` (details in ADMIN.md).
5. Fake client logins for testing (client-a@example.com, client-b@example.com): passwords in `/opt/portal/seed-passwords.txt` on the server.

## 3. What was built

- **Client portal:** overview, business profile, contacts, Plan 1 scope, timeline (kickoff → build → testing → go-live), documents (download + drag/drop upload), results (speed-to-lead, calls, bookings, booking rate, minutes vs 1,200, 30-day charts, daily table). Dark-first, responsive.
- **Admin panel:** client list with portfolio stats and activity log; create client; per-client tabs for settings, profile, contacts, scope, timeline, documents, results, users (invite/resend/disable), ingest keys (generate with copy-once secret, revoke); TOTP MFA enrolment.
- **Auth:** email + password and email magic link (GET never consumes the link), password reset, invites, Argon2id, lockout, DB rate limits, admins need TOTP, 12h admin sessions, immediate revocation.
- **Isolation:** server-resolved tenant, scoped queries, Postgres RLS (FORCE) on every table, runtime role `portal_app` not owner and no BYPASSRLS, signed + tenant-checked file route, 404 for every cross-tenant attempt.
- **Ingest API** `POST /api/ingest/results` with per-client bearer key (SHA-256 stored), optional HMAC body signature, strict schema, upsert by (client, day). See N8N.md.
- **Infra:** Docker (`/opt/portal`), own Postgres container (`portal-db`, private network, no host port), app on `127.0.0.1:3020`, Caddy block appended (backup of the Caddyfile kept), nightly backup 02:30 (DB dump + uploads, 14-day retention, verified with a restore listing).
- **Seed:** only fake data (Test Client A/B, timeline, docs, 30 days of results).
- Docs: README.md, ADMIN.md, N8N.md, PLAN.md.

## 4. Test results

`npm test` ran against a fresh Postgres and the real production build: **7 files, 51 tests, all passing** (run before deploy).

| Suite | What it covers |
|---|---|
| `isolation/pages-and-files` | Client A on every client page: no B names/ids/emails and no member lists. `/admin*` → 404 for a client. Anonymous → login redirect. Files: no sig / forged sig / valid sig minted for A on B's doc / other user's sig / expired / malformed ids → all 404; own file returns the exact bytes. Upload with `clientId=B` lands in A (verified in DB). |
| `isolation/ingest-api` | missing, garbage, tampered and revoked keys → 401; A's key + B's `client_id` → 400 with B unchanged; A and B keys write only their own rows; validation; HMAC good/bad. |
| `isolation/server-actions` | Fires every admin server action as a client at B's ids; asserts B's DB state is unchanged and nothing leaks. **Limit:** these calls use a simplified request encoding, so a failure could come from the encoding rather than the auth check. The auth guarantee comes from the next suite. |
| `static-guards` | Every admin action calls `requireAdmin()` first; every admin/client page enforces its guard; client data functions take no clientId; no `dangerouslySetInnerHTML`. |
| `rls` | As `portal_app`: no context → 0 rows in all 12 tables; client A sees only A (and only its own user row); writes to B rejected; no privilege escalation; ingest scope limited to its client; junk role strings get nothing. |
| `auth` | wrong/unknown user same error; lockout; disabled user; IP rate limit; MFA required / wrong / right / replayed code; admin without MFA locked out of admin; magic link single use, expiry, type confusion; session killed by `session_version` bump or disabling. |
| `headers` | CSP with nonce, HSTS, X-Frame-Options, nosniff, Referrer-Policy, no X-Powered-By, session cookie HttpOnly + SameSite=Lax, no open redirect. |

`npm audit --omit=dev`: **0 vulnerabilities**. A weak placeholder test ("magic request responds identically") only checks the DB, not the response text; the enumeration-safe behaviour is in code (`requestMagicLink`) but isn't covered by a real assertion yet.

**Not tested on the live server:** I didn't sign in through https (DNS isn't up). On the VPS I checked health, headers, the `/admin` → `/login` redirect, roles (`portal_app` not super, no bypassrls), seed (2 clients, 60 result rows) and a backup dump.

## 5. RAM next to Twenty (VPS, 7.7 GB total)

| Container | Memory |
|---|---|
| portal-app | 68 MiB (limit 768) |
| portal-db | 38 MiB (limit 512) |
| twenty-server / worker / db / redis | 863 / 879 / 63 / 24 MiB |
| bookstack + db | 72 / 125 MiB |

Host: 2.8 GB used, 4.9 GB available. Twenty, BookStack and their Caddy routes were still healthy afterwards (`crm` 200, `docs` 302).

## 6. Env vars still to fill (in `/opt/portal/.env`, then `cd /opt/portal && sudo docker compose up -d portal-app`)

- `RESEND_API_KEY` (and check `EMAIL_FROM`; the sending domain must be verified in Resend). Until set, emails are only logged: `sudo docker logs portal-portal-app-1 | grep -A3 "email:stub"`.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Until all four are set, files live on local disk (`/opt/portal/uploads`, included in the nightly backup). Files already on disk are **not** migrated automatically when you switch to R2.

## 7. Known gaps

- DNS and live https sign-in not verified yet (above).
- Quentin's admin account not created (email unknown).
- Twenty read-only pull (optional in the brief) not built. The `twenty_company_id` field exists on clients.
- Backups sit on the same VPS; no off-box copy yet.
- Admin MFA recovery is manual (SQL).
- No email notifications to clients on new documents or milestone changes.
- Several of the early test cases are black-box over HTTP; there's no browser-level (Playwright) test.
- The three sub-agents I'd launched in parallel were stopped before finishing, so the UI, tests, infra and docs were all written directly by me in this session. Nothing from the agents' partial work was kept except the UI primitives in `src/components/ui` and the Dockerfile, both reviewed.
- Twenty, n8n, Retell, SSH, UFW and fail2ban were not touched. The only change outside `/opt/portal` is the appended `portal.kyneticai.com` block in `/etc/caddy/Caddyfile` (backup alongside it), plus `/etc/cron.d/portal-backup` and `/usr/local/sbin/portal-backup.sh`.

## 8. Next steps

1. Add the DNS record, open the invite link, enrol MFA.
2. Create Quentin's admin.
3. Add Resend and R2 keys.
4. Create a real client and an ingest key, then wire the n8n daily push (N8N.md).
5. Add an off-box backup copy and a Playwright smoke test.
6. Decide whether to build the read-only Twenty sync.
