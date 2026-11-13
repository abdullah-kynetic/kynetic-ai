# Phase 4 security review (2026-11-13)

Scope: auth, sessions, service tokens, webhook signatures, file access, the staff email-code login (KI-033), plus the shared request plumbing (rate limits, Origin check, security headers) those rely on. Method: read the code in `crm/src/server/{auth,security,service-auth,leads,webhooks,documents,adapters,impersonation}` and every route under `crm/src/app/api`, then fix or record each finding. Not covered: the live server's Caddy and Cloudflare settings (not reachable from a cloud session, see S-01), provider-side settings, penetration testing against the live portal.

## Fixed in this phase

| ID | Severity | Finding | Fix | Proof |
|---|---|---|---|---|
| S-01 | Medium | `clientIp()` took the FIRST `X-Forwarded-For` entry. Caddy appends the visitor address to whatever header the visitor sent, so anyone could pick their own "IP" and dodge the per-IP limits (sign-in 5/min, lead webhook 120/min) and forge the address stored in terms acceptances and view-as audit rows. | Both copies of `clientIp` now use the LAST entry, the one our own proxy added. | `tests/unit/with-api.test.ts`, `tests/unit/terms.test.ts` |
| S-02 | Medium | The Twilio and voice-provider webhook routes used ONE global rate-limit bucket (`twilio`, `voice`, 600/min) that is spent before the signature is checked. Anyone could send 600 unsigned requests a minute and lock out real call-end and SMS webhooks. | The bucket is now per source IP (`twilio:<ip>`, `voice:<ip>`). Resend was already per IP. | Route change; limiter tests unchanged |
| S-03 | Medium | A service token (n8n) kept working after its client was suspended or offboarded, unless someone revoked it by hand. | `authenticateServiceToken` now refuses a token whose tenant is `suspended` or `offboarded`; it works again on reactivation. | `tests/integration/service-tokens.test.ts` |
| S-04 | Low | The lead webhook called `request.text()` and measured the body afterwards, so a chunked upload with no `Content-Length` was fully buffered before the size check and before the signature check. | The body is now read as a stream and cut off at 16 KB. | `tests/integration/lead-intake.test.ts` |

## Checked and fine

- Sessions: signed cookie, then a live database row, user not disabled, idle and absolute lifetimes re-checked on every request; `__Host-` cookie name, HttpOnly, SameSite Lax, Secure on https; no cookie cache, no silent refresh.
- Origin check on every state-changing browser request (proxy plus `withApi`); machine paths (`/api/hooks/*`, `/api/service/*`) are exempt and carry their own credentials.
- CSP is nonce based with `strict-dynamic`, no `unsafe-eval` in production, frame-ancestors none, HSTS, nosniff.
- Staff TOTP: only enrol and verify are reachable, backup codes are never issued or returned, five failures lock for 15 minutes, a used code cannot be replayed within 120 seconds, and every failure is audited.
- Email-code login: the code is stored as a keyed hash, five attempts then the code is deleted, 10 minute life, constant-time compare, one message for every outcome (no account enumeration), per-email send limit, every outcome audited. Staff get a code only when `STAFF_EMAIL_LOGIN` is on.
- Service tokens: 256-bit random secret, only the SHA-256 stored, constant-time compare, tenant taken from the token row never from the request, scope checked on every route, lookup through a narrow `SECURITY DEFINER` function.
- Webhooks: lead webhook HMAC over timestamp plus raw body with a 5 minute window and a throwaway key for unknown tenants; Twilio, Resend, ElevenLabs and Retell signatures use `timingSafeEqual`; every accepted event is stored once (unique source plus external id), so replays do nothing.
- Files: document and logo downloads take the tenant from the session, check the storage key prefix against that tenant, and hand out 5 minute signed URLs; uploads are PDF-checked (documents), re-encoded PNG (logo), size and zip-entry capped (imports).
- View-as: every request re-reads the session row under the client's RLS context and re-checks the live staff role and second factor; VA is read-only whatever the row says.
- Persona switching cannot be enabled when `NODE_ENV=production`.
- Every route under `crm/src/app/api` either authenticates through `withServiceAuth`, a verified session, a signature, or is the health check (which returns only status, commit and worker age).

## Recorded, not changed (with reason)

| ID | Severity | Finding | Why not changed |
|---|---|---|---|
| S-05 | Medium | **KI-033, needs Abdullah's decision.** With `STAFF_EMAIL_LOGIN=true`, a staff sign-in (by code OR by Google) skips the authenticator and lasts 30 days, so a hijacked staff mailbox is a hijacked admin account with access to every client's data. | The setting is off by default and was turned on at his request. Recommendation: turn it off before the first real client data goes in, or keep it only if the mailbox has hardware-key or passkey sign-in. |
| S-06 | Low | The live Caddy and Cloudflare settings behind S-01 could not be checked from here. The repo's `deploy/prod/Caddyfile` trusts Cloudflare ranges and uses `CF-Connecting-IP`, which is the setup the LAST-entry rule assumes. | Server read needs the VPS; check `/opt/portal-new` Caddy config on the next server visit. |
| S-07 | Low | The lead webhook still accepts leads for a suspended tenant whose `alex_core` module is on. | Whether a suspended client's website form should keep capturing leads is a business call. |
| S-08 | Low | Service-token routes have no request rate limit; a flood of well-formed tokens costs one database lookup each. Guessing a token is not feasible (256 bit). | Cloudflare WAF rate rules are the right place, and that is a live change that needs a yes. |
| S-09 | Info | `/api/hooks/leads/dev/[tenantKey]` still ships, but refuses to run unless `NODE_ENV` is non-production and `APP_BASE_URL` is the retired DEV host. | Guarded; removal belongs with the DEV-environment archive in phase 1. |
| S-10 | Info | The email-code send path does a mail call and the suppressed path does not, so response time can hint whether an address is allowed. The message text never differs. | Per-IP and per-email limits make a timing probe expensive; fix only if it matters. |
