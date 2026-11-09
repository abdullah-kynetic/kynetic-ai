# Security

> **Technical security rules for the portal codebase (scope banner, 2026-11-09).** Not the business roadmap. Current direction: `docs/STATUS.md`. DNC scrub, stored consent, and quiet hours are required operating controls. Twilio A2P approval is not permission for cold SMS. Counsel items in this file stay open. This banner does not change the controls.

Kynetic Client CRM & Portal. Owner: Abdullah. Status: draft for review, Oct 25, 2026.

**Sources.** `SPEC_client_crm_portal.md`, `DECISIONS_locked.md` (these win over the spec), `docs/PRD.md` (authoritative for feature IDs F-01 to F-106, module keys and the module catalog, and for open decision numbers "OD-n"), `docs/CODE_STYLE.md` (error codes, logging), and the Kynetic hard rules.

**Conventions.**
- Feature IDs `F-xx` and module keys are the PRD's. Nothing here defines a feature.
- `Decided 2026-10-25 (recommended option approved: ...)` marks anything not settled in the sources. Cite the PRD decision number where one exists. Items with no PRD decision number are listed in Appendix B.
- `Not configured` marks any command, tool or setting not yet verified.
- This file does not establish regulatory compliance. Items marked "counsel" need a lawyer's answer before real client leads are contacted.
- "Must" means a PR cannot merge without the control and its test in `docs/TESTING.md`.

---

## 1. Assets and trust boundaries

### 1.1 Protected data
| Asset | Where | Why it matters |
|---|---|---|
| Client customer PII: names, phones, emails, addresses, job details | `contacts`, `companies`, `deals`, `notes`, `appointments` | The client's customers. A breach is a legal and trust event |
| Call recordings, transcripts, AI summaries | `calls`, object storage | Third parties' voices and speech. Recording-consent law applies |
| SMS and email bodies | `messages` | Same as above |
| Consent evidence: wording, source, timestamp, IP, revocations | `consents` | Our defence in a TCPA claim. Append-only in effect |
| Provider credentials: Retell/ElevenLabs, Twilio, Resend, Google OAuth, n8n tokens, signing secrets, backup keys | Environment and encrypted columns | Control of calling, texting and billing |
| Business data: baselines, metrics, plan and tier, guarantee status | `tenants`, `metrics_daily` | Commercially sensitive per client |
| Auth state: sessions, accounts, invite tokens | Auth tables | Account takeover |
| Audit log | `audit_log` | Integrity of every other control |
| Backups | Offsite R2/B2 | A full copy of every tenant's data |

Client data never goes to Twenty (locked decision). Twenty receives at most an optional tenant summary (MRR, status), per the spec's integrations table.

### 1.2 Trusted and untrusted inputs
| Input | Trust | Handling |
|---|---|---|
| Browser requests from client and Kynetic users | Untrusted until authenticated; authorization checked on every request | Session, role, tenant and module checks; Zod validation (section 5) |
| Lead webhook `/api/hooks/leads/:tenantKey` (forms, Angi, Google LSA, Facebook) | Authenticated by signed token; field contents are untrusted text | Section 3.6. F-76 |
| Retell/ElevenLabs call-end webhooks and booking tool calls | Provider signature; transcript and extracted content still untrusted text | Section 3.6 |
| Twilio status and inbound SMS webhooks | Signature-verified; inbound body untrusted | STOP/HELP handling (3.3). Never rendered as HTML |
| Resend webhooks | Signature-verified | Bounce and complaint handling |
| n8n calls into our API | Tenant-scoped service token. The n8n VPS is a less-trusted zone | Section 2.3 item 9. F-89 |
| Onboarding import files (F-90) and logo upload (F-39) | Untrusted files containing client PII | Section 5.3 |
| LLM output (summaries, extracted fields) | Untrusted | Schema-validated, plain text, never executed (5.2) |
| Provider recording URLs | Untrusted URL | Fetched only from allowlisted provider hosts (5.2 SSRF) |
| Kynetic staff (admin, VA) | Trusted, highest blast radius | Sections 2.2, 2.6, audit log |

### 1.3 Boundaries
1. **Internet to Cloudflare to app.** Cloudflare terminates TLS and runs the WAF. The origin accepts traffic only through Cloudflare (Tunnel, or Caddy restricted to Cloudflare ranges). No port is published except through that path. Verification: `Not configured` until the M0 Compose file exists.
2. **App to Postgres.** The app connects as a non-owner role without superuser or `BYPASSRLS`, so RLS always applies (F-72). Postgres is reachable only on the Docker network.
3. **Tenant to tenant.** The most important boundary, enforced in the database and not only in code (2.3).
4. **Client users to Kynetic admin side.** Admin routes and data are unreachable to client roles, enforced server-side (F-53 to F-63).
5. **Production to preview.** Separate databases and secrets, no real client data in preview, outbound disabled outside production (6.2).
6. **This app to Twenty and n8n.** Neither receives client PII from this app's core flows. n8n is called and calls back only with token or signed requests.

### 1.4 Threats
| # | Threat | Main controls |
|---|---|---|
| T1 | Cross-tenant read or write (missing `tenant_id` filter, bad join, admin query leak) | RLS with `FORCE`, non-owner role, per-transaction `app.tenant_id`, isolation tests in SQL and API (2.3, F-72) |
| T2 | Privilege escalation: staff acting as owner, VA acting as admin, client reading the raw Alex prompt | Server-side role matrix (2.2, F-73), allowlisted DTOs, denial tests |
| T3 | Use of an upsell the tenant does not have (direct API call, stale job) | Server-side module guard on every route, action, job and webhook (2.4, F-70) |
| T4 | Unconsented or illegal contact: no consent, after STOP, quiet hours, unapproved SMS | One compliance gate for every send (3.1 to 3.4, F-74) |
| T5 | Forged or replayed webhook creating leads, fake outcomes or fake STOP events | Signature check, timestamp window, idempotency (3.6, F-77) |
| T6 | Secret leak through logs, repo, browser bundle, error pages, Sentry, backups | Section 4, redaction (6.2), secret scanning in CI |
| T7 | Impersonation abuse or insider misuse | Read-only default view-as, banner, audit with `impersonator_id` (2.6, F-57) |
| T8 | Account takeover (phished Google account, stolen session, invite hijack) | Google sign-in, server-side sessions with live checks, single-use invites, instant revocation (2.1, F-71) |
| T9 | Injection: SQL, stored XSS, CSV formula injection, prompt injection through lead text or transcripts | Parameterized queries, sanitization, escaping, CSP, LLM output as data (5) |
| T10 | Abuse: login brute force, webhook floods, runaway Alex calling loop, cost blow-up | Rate limits (5.4, F-87), per-contact and per-tenant caps, kill switch (3.9) |
| T11 | Data loss or ransomware | Encrypted offsite backups, 30 daily + 12 monthly, monthly restore test (6.4, F-63) |
| T12 | Unreviewed deploy reaching real clients | Preview-only deploys until Abdullah approves (6.2) |
| T13 | Unauthenticated webhook endpoints, as found in existing Kynetic tooling | Every hook route has a verifier at registration (3.6). KI-005 lesson |

**Lesson from KI-005.** The ICM map found that webhook auth was missing in existing Kynetic tooling (KI-005), and that nothing feeds the old portal's `/api/ingest/results` safely. Rule for this app: every route under `/api/hooks/*` and `/api/service/*` is wrapped by a verifier at registration. A route with no verifier fails the startup check and CI (SEC-T-20). There is no "add auth later" path.

---

## 2. Authentication and authorization

> **Open mode (DC-TBD-15, 2026-11-02): sign-in is removed until the end of the build.** There is no login, session, magic link, Google sign-in, second factor or terms gate in the code. A cookie (`kynetic_open_as`) picks one of the existing users, and `/open/<admin|va|owner|staff>` switches it. Authorization (the permissions matrix), tenant RLS and the audit log still apply to the chosen user. Everything below that describes sign-in, sessions, TOTP and the terms gate describes the design to restore, not the current code. Do not expose an open-mode build to the public internet; put network access control in front of it (for example Cloudflare Access) or restore sign-in first.

### 2.1 Identity and sessions (F-71)
- **Decided:** drop Clerk. Better-Auth with Google sign-in and email magic links (PRD decision 2).
- **Library.** Decided 2026-10-25: Better-Auth, behind the `src/server/auth` facade (ARCHITECTURE).
- **Email magic link.** Decided 2026-10-25: ships for client users alongside Google sign-in. Single-use, short-lived, rate limited (5.4), sent through Resend. Staff accounts use Google plus TOTP. The platform auth message is transactional, not contact outreach; it is wired at Node app/worker startup and is not routed through marketing-contact consent dispatch. Its URL is HTML-escaped, receives a URL-hash idempotency key, and must never be logged.
- **Staff sign-in.** Kynetic admin and VA accounts sign in with Google accounts on an explicit allowlist, plus app-level TOTP (F-98, below).
- **Account linking.** Link a Google identity only when Google reports the email as verified. Never link by unverified email.
- **Sessions.** Server-side sessions in Postgres, not self-contained tokens, so revocation is immediate. Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix.
- **Auth connection (DC-055).** Better-Auth connects as `kynetic_auth`, a separate role with grants on the global auth tables and a column-limited slice of `users`, `memberships` and `invitations`. Sign-in needs staff status, a membership, or a pending invitation; staff get no email link.
- **Lifetimes.** Decided 2026-10-25 (recommended option approved: Kynetic staff 12 h idle and 7 days absolute; client users 30 days sliding and 90 days absolute; re-auth before exports, role changes and view-as write mode).
- **Live checks.** Role, tenant membership and module state are read from the database on each request (or cached at most 60 s with invalidation). Nothing is trusted from a cookie claim.
- **CSRF.** `SameSite=Lax`, Origin check on every state-changing route and server action, no permissive CORS on `/api`. Implemented in `src/proxy.ts` (M0-21): a missing or foreign Origin on a state-changing request returns 403 `FORBIDDEN`; `/api/hooks/*` and `/api/service/*` are exempt (signature and bearer auth).
- **2FA (F-98).** In v1 for Kynetic admin and VA (Decided 2026-10-25): TOTP via the Better-Auth two-factor plugin, enforced at sign-in on top of Google, with single-use recovery codes and a logged reset by another admin. A staff account without TOTP enrolled can reach only the enrolment page. Owner and staff TOTP stays Later. Built in M0-12 (DC-066): the plugin's own sign-in challenge does not cover Google sign-in, so a staff session is fully signed in only once `sessions.two_factor_verified_at` is set by a passing code, and `requireUser` refuses a staff session that is not (states `enrol` and `challenge`). Five wrong codes lock the account's verification for 15 minutes. A TOTP code works once. Recovery codes (10) are stored as keyed hashes and each works once. Staff cannot disable their own 2FA; only another admin can reset it (`admin_reset_staff_two_factor`), which removes the secret and codes, signs the person out everywhere and audits before and after. Enrol, failed and locked attempts, recovery-code use and resets all write `audit_log`.

### 2.2 Roles and permissions matrix (F-73)
Roles from spec section 2: Kynetic admin and Kynetic VA (`users.kynetic_role`), client owner and client staff (`memberships.role`). **Deny by default**: a cell that is not "Yes" is a denial. Enforcement is server-side on every action. The UI hides what the server would refuse.

| Capability (feature) | Kynetic admin | Kynetic VA | Client owner | Client staff |
|---|---|---|---|---|
| Read and write own-tenant CRM data: contacts, companies, deals, tasks, notes, calendar (F-05 to F-24) | Via view-as | Via view-as; edits on request only, logged as a support edit | Yes | Yes |
| View calls, transcripts, recordings (F-26, F-27) | Yes | Via view-as | Yes | Yes |
| Flag a call for Kynetic review (F-28) | Yes | Yes | Yes | Yes |
| Per-call cost (F-29, Later) | Yes | Yes | No in v1 | No in v1 |
| Bulk tag, owner, status (F-08) | Yes | No | Yes | Yes |
| Bulk delete (F-08) | Yes | No | Yes | Off by default; owner can toggle on |
| CSV export (F-38) | Yes | No | Yes | Off by default; owner can toggle on |
| Onboarding import (F-90 to F-94) | Admin only in v1 (client-side is Later, F-95). `.csv` and `.xlsx` only, checked by extension, MIME and file signature. `.xlsm`, `.xls` and archives are refused. Decided 2026-10-25 (recommended option approved: 10 MB, 50,000 rows). XLSX is parsed as data: formulas are read as their cached values and never evaluated, macros and external links are ignored, and decompressed size and entry count are capped (zip-bomb guard). Raw file stored privately under `tenant_id/imports/`, encrypted at rest, never served back to the browser, deleted 30 days after commit (decided, recommended option). Parsed in the worker inside the tenant's RLS context. Every row is validated with Zod; cells are treated as plain text, never HTML (stripped on save). Dry run required before commit. Every step is audited with the admin as actor. Imports never start calls, texts or sequences, and imported contacts have no consent unless the file maps consent evidence (F-96). |
| Team, roles, invites (F-41) | Yes | No | Yes, own tenant | No |
| Branding, business profile, pipelines, custom fields, tags (F-39, F-41, F-43) | Yes | No | Yes | No |
| Alex client-visible settings (F-42) | Yes | No | Owner, permitted fields only | No. Decided: pause Alex and call hours only (PRD decision 8) |
| Raw Alex prompt, provider, agent ID, voice (F-58) | Yes | No | No | No |
| Automation templates on or off (F-31, F-32) | Yes | No | Owner, only for enabled modules | No |
| Module flags (F-70) | Yes | No | No | No |
| Notifications and own preferences (F-35, F-36) | Yes | Yes | Yes | Yes |
| All clients, health score, integration health (F-53, F-54, F-62) | Yes | Read | No | No |
| Onboard a client (F-55) | Yes | No | No | No |
| View-as (F-57) | Yes | Read-only | No | No |
| Users across tenants (F-61) | Yes | Invite and reset client users only | No | No |
| Audit log (F-60) | Yes | Read | No | No |
| Backups page, manual backup (F-63) | Yes | Read status only | No | No |
| Billing, delete tenant, manage admin accounts | Yes | No | No | No |

Implementation rules:
0. The matrix is encoded in `src/server/auth/permissions.ts` (DC-056) and tested row by row in `tests/unit/auth/permissions.test.ts`.
1. One `authorize(actor, action, resource)` function, called by every route handler, server action and job. No ad hoc role checks in components.
2. Client DTOs are built from allowlists in the query layer, so fields clients must not see (`calls.cost_cents` in v1, provider IDs, raw prompt, anything from another tenant) are never fetched. Hiding them in the UI is not enough.
3. A route that takes an `id` loads the row under the caller's tenant context. A foreign `id` returns `NOT_FOUND`, not `FORBIDDEN`, so existence is not leaked. This matches `docs/CODE_STYLE.md`.
4. @mentions in notes (F-22) resolve only to members of the same tenant.

### 2.3 Tenant isolation (RLS, F-72)
1. Every table holding client data has `tenant_id NOT NULL`, `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`, with policies. `docs/DATABASE.md` owns the table list. CI enforces it (SEC-T-01).
2. Policies compare `tenant_id` to `current_setting('app.tenant_id', true)::uuid`. A missing setting returns no rows (fail closed).
3. The tenant is set per transaction (`set_config(..., true)`), derived from the authenticated membership, **never** from a request parameter or header. Pooled connections must not carry a previous tenant (SEC-T-04).
4. Roles: an owner role used only for migrations, run from CI or deploy and never present in the app's runtime environment; an app role; a worker role. App and worker are non-owner, not superuser, not `BYPASSRLS`.
5. Tables without `tenant_id` need explicit policies: `tenants` (visible through membership), `memberships`, `users` (own row and co-members), `webhook_events` (app role INSERT-only, no SELECT, so the webhook route can store but not read payloads; worker role reads and updates; payloads may hold PII), auth tables (auth library role only).
6. Kynetic cross-tenant views (F-53, F-54, F-62, F-63) read through a small set of `SECURITY DEFINER` roll-up functions or views that return non-PII aggregates only. Opening a tenant's rows requires view-as, which sets `app.tenant_id` for that tenant and is audited. No policy contains an `OR is_admin` clause that exposes all rows to a session. Exact mechanism: Decided 2026-10-25 (recommended option approved, owned by DATABASE.md).
7. Jobs and webhook processors resolve the tenant from a trusted mapping (`:tenantKey`, agent ID, Twilio number, all mapped server-side), then set `app.tenant_id` for the unit of work. A payload whose `tenant_id` disagrees with the referenced record is rejected (SEC-T-06).
8. CI gate: a script lists every table with a `tenant_id` column and fails if any lacks enabled, forced RLS and a policy (SEC-T-01). A new table without a policy cannot merge.
9. **n8n access.** The spec has n8n call our API with a service token. Decided 2026-10-25 (recommended option approved: one token per tenant, scoped to that tenant and to a short route allowlist such as create-contact, update-deal-stage and event-ack; no all-tenants token; stored hashed; revocable per tenant from F-62; rotated on request). F-89 requires tenant scoping and revocation (401 after revoke). The n8n VPS holds many credentials and is treated as a less-trusted zone.
10. **Recordings** are stored under a `tenant_id/` key prefix, in a non-public bucket. Access is by short-lived signed URL minted after `authorize()`. Decided 2026-10-25 (recommended option approved: 5-minute expiry). Storage model, decided 2026-10-25 (PRD decision 9): copy provider recordings to R2 on call end. Either way, the browser never receives a raw provider URL.

### 2.4 Module gating (F-70)
Locked decision: each Kynetic system and upsell has its own backend and is toggled per tenant with feature flags. Rule: **UI hiding is cosmetic; the server is the gate.** The PRD module catalog defines the keys below. Keys are stored one row per tenant and module (`tenant_modules`; schema owned by DATABASE.md).

| Module key | Gates (PRD catalog) | Security notes |
|---|---|---|
| `platform` | Always on. Auth, tenancy, settings, notifications, audit, admin side | Cannot be turned off |
| `alex_core` | F-01 to F-03, F-24 to F-29, F-42, F-46, F-49, F-56, F-58, F-59, F-74 to F-76, F-78 | Outbound calls, recordings, booking tool |
| `quote_followup` | F-79 | Sequences on Quoted deals |
| `after_hours` | F-80 | Inbound calls outside hours |
| `missed_call_textback` | F-81 | SMS. Free with `after_hours` per decisions; SMS gate still applies (3.7) |
| `reactivation` | F-82 | Highest compliance risk (3.8). One-time campaign |
| `opm` | F-83 and F-48 | v1 stores status records and review snapshots only; no vendor credentials or OAuth integrations (PRD decision 6) |
| `followup_bundle` | F-84 | Convenience grant that enables member flags. Bundle contents: PRD PRD 7 |
| `crm` with level `lite` or `full` | Lite: F-10, F-17, F-20, F-22, F-43. Full: F-08, F-12, F-15, F-37, F-38. F-85 | Upsell on top of the base portal. Base routes (F-05 to F-07, F-14, F-16, F-19) are not gated by `crm` (PRD 1) |

Rules:
1. `requireModule(ctx, key)` runs first in every route handler, server action, job handler, webhook processor and admin action that belongs to a module. It reads the flag from the database for that request or job run. It is not read from the client or a token claim. Cache at most 30 s, invalidated on write.
2. Module off returns **403** with code `MODULE_DISABLED`, as PRD F-70 and `docs/CODE_STYLE.md` specify. Nothing is written. Queued jobs exit without side effects and record a skip. Webhooks for a disabled module are acknowledged with 200 and not processed, so providers do not retry forever, and the skip is recorded in integration health.
3. Check at **execution time**, not enqueue time. A step queued before a module was turned off must not run (SEC-T-12).
4. Only the Kynetic admin can change flags. Each change is audit logged with before and after values and takes effect within 30 s. Client owners can see their modules and cannot edit them.
5. Turning a module off stops its outbound activity immediately and keeps its data (F-70). Deleting data on cancel follows section 6.1.
6. `crm` levels: a tenant without `crm` gets 403 on every Lite and Full route, and a `lite` tenant gets 403 on Full-only routes (F-85); base-portal routes stay available (PRD 1).
7. Test matrix: for every module key, a tenant without it gets 403 and skipped jobs on every owned endpoint, and a tenant with it works (SEC-T-12).

### 2.5 Recovery and revocation
- **Invites.** Single-use, bound to the invited email, random 256-bit token stored hashed. Decided 2026-10-25 (recommended option approved: 7-day expiry). Owners invite staff. Kynetic admins invite owners (F-55, F-61).
- **Deactivate user** (F-61): in one transaction, marks the user inactive, deletes all sessions and removes pending invites. Audit logged.
- **Lost access.** Google recovery is Google's. Magic-link tokens are single-use, 15 minutes, rate limited. A VA-initiated reset is audited and notifies the user by email.
- **Provider and n8n tokens.** Revoke and rotate per section 4.2. A one-click revoke for a tenant's n8n token and signing secrets belongs to F-62.
- **Tenant suspension.** Setting `tenants.status` to suspended blocks logins and stops all outbound activity (queue gate checks status).
- **Emergency stop.** `OUTBOUND_ENABLED=false` (config) stops all outbound calls and texts. Per-tenant "pause Alex" (F-42) stops that tenant's. Defined in 3.9.
- **Provider stub mode.** `PROVIDER_MODE=stub` selects in-memory fake SMS and voice providers even when `NODE_ENV=production`; it is intended only for isolated rehearsals with `OUTBOUND_ENABLED=false`. The default is `live`, which keeps production fail-closed when provider credentials are missing. Stub mode cannot be combined with outbound enabled.

### 2.6 Impersonation ("view as client", F-57)
- Entry: Kynetic admin (read or write) and VA (read only). Start requires a reason for a VA; the admin role (super admin) may start without one (DC-125). An audit row records `impersonator_id`, tenant, start time and IP.
- **Read-only by default.** The request context carries `readOnly=true`, and the database transaction is `READ ONLY`, so a code bug cannot write. Decided 2026-10-25 (recommended option approved: admin may switch to write per session with a second reason and a 30-minute expiry; VA never gets write mode. VA edits on request use a separate logged support-edit action).
- A persistent banner reads "Viewing as <tenant>, read-only" with an exit control.
- Every request during the session writes audit rows with both the tenant context and `impersonator_id`.
- Impersonation cannot nest, cannot reach the Kynetic admin side, and cannot export, change users or roles, change modules, change billing, edit the Alex prompt, or send messages as the client. Texts and calls originate only from the system through the compliance gate.
- Decided 2026-10-25 (recommended option approved: 30-minute idle expiry). Recording playback during view-as is audited.

---

## 3. Compliance: consent, contact rules, webhooks

Product context. Alex is an **outbound speed-to-lead** agent. It calls people who submitted a lead form for the client (F-78). It is not a cold-calling tool. Kynetic's hard rules forbid AI cold calls, cold SMS and ringless voicemail, and require consent wording on callback forms (D-007). The portal must make prohibited contact impossible by default, not merely discouraged.

### 3.1 The compliance gate
One code path can start a call, send an SMS or send a marketing email: `canContact(ctx, contactId, channel, now, opts?: { purpose? })` (in `src/server/consent`, ARCHITECTURE). It returns allow, or deny with a reason code.
1. Provider adapters (Retell/ElevenLabs, Twilio, Resend) are imported only by the gate's `dispatch()`. A lint rule enforces this (SEC-T-13).
2. The gate runs **at send time, inside the job**, against the latest consent, opt-out, DNC, module and tenant state. A STOP arriving while a job is queued still blocks it.
3. Every allow and deny writes an `activities` row (F-19) and a log entry with the reason, so "why was this person called?" is answerable.
4. Deny reasons: `no_consent`, `consent_revoked`, `opted_out`, `internal_dnc`, `quiet_hours`, `module_off`, `tenant_suspended`, `alex_paused`, `outbound_disabled`, `sms_not_approved`, `rate_cap`, `unknown_timezone`.
5. Quiet-hours denials reschedule to the next allowed window. Other denials are final until state changes.

### 3.1a Proposed change (2026-10-31, not in effect until approved): n8n makes the contact decision

Abdullah decided that n8n runs the automations and makes the consent, quiet-hours and DNC decision (DECISIONS DC-TBD-08). This would replace 3.1 as the single gate. It is not in effect. Until the plan is approved and built, 3.1 and SEC-T-13 stand and nothing below is enforced.

If approved, the controls that keep it safe are:
1. One shared n8n sub-workflow, "may I contact", that every call, text and marketing email goes through. No workflow sends without it. A test fails if a workflow calls a provider without it.
2. The portal owns consent records, opt-outs, DNC lists and tenant state. n8n reads them at send time.
3. n8n posts every allow and deny to the portal with the reason code and the rule that fired. The portal writes the `activities` row (3.1 item 3).
4. The portal kill switch and per-tenant pause are read by the sub-workflow before every send (F-101).
5. A parity test runs the same inputs through the old portal gate and the n8n sub-workflow. Any difference is listed for Abdullah before go-live.
6. Counsel has not confirmed that this arrangement meets TCPA and state rules. Treat as open until they do (`docs/counsel-questions.md`).

### 3.2 Consent capture (TCPA, F-74)
- Stored per tenant, per contact, per channel (`voice`, `sms`, `email`) in `consents`: `type` (`express_written` or `opt_out`), `source`, `captured_text`, `ip`, `captured_at`, `revoked_at`. Consent given to one client is never reused by another tenant or by Kynetic.
- A form lead counts as consent only when its payload carries the consent wording shown and a capture time. The lead webhook writes the wording, source URL, IP and timestamp in the same transaction that creates the contact.
- **Required wording.** UNRESOLVED (needs counsel; working default: legal wording drafted by Abdullah, reviewed by counsel, stored as a versioned template per tenant. It must name the business, state that an automated or AI system may call or text, state that consent is not a condition of purchase, and give "reply STOP" instructions). The Cal.com consent checkbox and the Terms line are pending Abdullah's decision (PRD PRD 14 covers the D-007 scope).
- **Third-party leads** (Angi, Google LSA, Facebook). Their consent may not cover AI voice or SMS. UNRESOLVED (needs counsel; working default: create the contact with no consent, so Alex and SMS are blocked. A task goes to a human for the first contact, unless the client and an admin record a basis that counsel accepts).
- **Imported and manually created contacts** (F-07, F-38) default to no consent on every channel. An import can carry consent columns only with source and date. Scraped or purchased lists are never marked consented.
- **Manual consent entry** requires a free-text basis and is audited with before and after values.
- Revoking sets `revoked_at`. Rows are never edited to change `captured_text` or `captured_at`. New consent is a new row.
- The contact page (F-06) shows consent per channel.

### 3.3 STOP, HELP and DNC (F-74)
- Inbound SMS keywords `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` (case-insensitive, whitespace ignored) revoke SMS consent for that contact on that tenant's number, in the same transaction that stores the inbound message. One confirmation is sent, and it is the only message allowed afterward. `HELP` returns business name and contact details. Carrier-level STOP also applies on Twilio, but our record must be written regardless.
- A DNC outcome from Alex (spec outcome chip) or a spoken do-not-call request revokes voice and SMS consent, marks the contact `internal_dnc` before the next dispatch, and ends the call politely. UNRESOLVED (needs counsel; working default: this behavior).
- SMS STOP revokes SMS only. Free-text "do not contact me" replies are flagged for human review. UNRESOLVED (needs counsel; working default: as stated).
- The internal DNC list is per tenant and survives merge, delete and re-import. Deleting a contact keeps a salted hash of the E.164 number as a tombstone (Decided (recommended option approved)).
- National and state DNC registry scrubbing is required before reactivation (3.8) and before any lead without fresh express written consent. Vendor and registry: not chosen. Decided in Appendix B.

### 3.4 Quiet hours (F-74)
Spec: quiet hours by contact timezone. Decided 2026-10-25 (PRD decision 18): contact only between 08:00 and 21:00 in the lead's local time, with stricter state windows layered on top (a per-state table; the table content is UNRESOLVED and needs counsel). The 60-second speed-to-lead promise yields to quiet hours: a lead outside the window is queued and contacted when it opens.
- Contact timezone comes from the address or ZIP, then area code, then tenant timezone. With low confidence, use the stricter option.
- Applies to AI voice and SMS, to every module, and to speed-to-lead. A lead at 22:00 local waits for the next window. This changes the "within 60 seconds" promise in F-78 (see Appendix B and PRD 13).
- Tenant `business_hours` and Alex `call_windows` also apply. The stricter constraint wins.
- Enforced in the gate at send time with an injectable clock for tests.

### 3.5 Recording disclosure (F-75)
- Alex states at the start of each call that it is recorded. The disclosure text is stored per tenant with a version. The disclosure is required in the Alex config (F-58); a save without it is rejected (SEC-T-17). Client settings (F-42) cannot remove it.
- Each `calls` row records the disclosure version played. Decided 2026-10-25 (recommended option approved: `disclosure_version` column, owned by DATABASE.md).
- Recording starts only after the disclosure. For two-party-consent states, the call is marked for review (F-75). UNRESOLVED (needs counsel; working default: an objection ends recording and logs "recording declined"). The list of flagged states is a versioned config reviewed by counsel. The app does not hard-code legal conclusions.
- Simplest safe rule, decided: play the disclosure on every call regardless of state.
- Voice may be biometric or sensitive data under some state laws. Decided: no voiceprint analysis. Retention: PRD PRD 9.

### 3.6 Webhook verification and idempotency (F-76, F-77)
Receive path, the same for every provider:
1. Read the **raw body** before parsing. Verify the signature with a constant-time comparison. Reject with 401 and no detail. Write nothing.
2. Check the timestamp where the provider signs one. Decided 2026-10-25 (recommended option approved: 5-minute window).
3. Insert into `webhook_events` with a **unique constraint on (source, external_id)**. The spec says `external_id` alone, but multiple providers are used, so the composite is safer (C9). A duplicate insert is a no-op that returns 200. This holds under concurrent delivery (SEC-T-14).
4. Enqueue a pg-boss job keyed by `webhook_events.id` and return 200 quickly. The job re-checks tenant, module and compliance state, then processes. Failures retry with backoff. Permanent failures set `webhook_events.error`, increment `integrations.error_count` and appear in F-62. pg-boss and Resend are decisions (PRD PRD 4).
5. Handlers are idempotent in effect: a retry never creates a second contact, appointment or message.
6. Tenant resolution uses our own mapping (path `:tenantKey`, agent ID, Twilio number), never a field in the payload.

Verification per source. Header names and algorithms are checked against current provider docs at implementation, so each row is `Not configured` until then.

| Source | Verification | Notes |
|---|---|---|
| Lead webhook `/api/hooks/leads/:tenantKey` (F-76) | Per-tenant signed token (spec). Decided 2026-10-25 (recommended option approved: HMAC-SHA256 over the raw body with a per-tenant secret, plus timestamp; revocable and rotatable from admin) | Rate limited (F-87). A leaked `tenantKey` alone must not be enough. Built in M4-04: header names, window, secret storage and rotation in DC-073 |
| Retell | Provider signature header | Verify per Retell docs. Tenant mapped by agent ID |
| ElevenLabs | Provider HMAC signature with timestamp | Verify per ElevenLabs docs. Per-environment secret |
| Twilio | `X-Twilio-Signature` against the exact public URL and params | Test behind Cloudflare with the forwarded host |
| Resend | Svix-style signature | Bounces and complaints feed email suppression |
| Booking tool (Alex calls availability and create-appointment) | Per-agent secret or signed request; tenant from agent mapping | Business hours only (F-78). Appointments only for the call's contact |
| n8n calling our API (F-89) | Tenant-scoped service token (2.3 item 9) | Same verifier registry |
| Our events to n8n (lead.created, deal.stage_changed, call.completed) | We sign outbound. n8n workflows must verify. KI-005 found existing n8n webhooks accept unauthenticated calls | Send IDs, not full PII. Decided 2026-10-25 (recommended option approved) |

### 3.7 SMS gating until A2P approval
Status in sources (Oct 22 project notes): the local 10DLC number has an approved sole-proprietor brand, but **no campaign**, and sends fail with error 30034. Two-way inbox is Later (F-47).
- SMS is denied by default (`sms_not_approved`) unless the tenant's Twilio integration shows an approved campaign, set by an admin after checking Twilio. Status shows in F-62.
- Text-back (F-81) and SMS steps are skipped with a visible "SMS not approved" activity, not silently dropped.
- STOP and HELP handling is built and tested in M4 regardless of approval.
- Whether each client needs its own registration or Kynetic registers on their behalf: Twilio-account decision (see Appendix B).

### 3.8 Old-lead reactivation (F-82): highest risk
- Only contacts with valid, unrevoked consent covering the channel, with evidence, are eligible. A list with no evidence is blocked, because it is cold outreach.
- UNRESOLVED (needs counsel; working default: AI voice or SMS only where original consent is recorded and no older than 12 months. Otherwise a task goes to a human. Counsel).
- Must pass DNC scrub (3.3) first.
- Dry-run audience preview, approved by a tenant owner (audit logged), then launch. Per-tenant daily cap (5.4).

### 3.9 Kill switches and caps
- `OUTBOUND_ENABLED` config: false in every non-production environment. In production, an admin can set it false to stop every tenant at once.
- Per-tenant pause (F-42) and tenant suspension stop that tenant's outbound.
- Caps (5.4) stop a retry loop or bad automation from calling one contact repeatedly.

---

## 4. Secrets and configuration

**Rule: secret values are never printed, logged, committed, pasted into docs, PRs, chat or tickets, or sent to the browser.** Kynetic hard rule. CI secret scanning is `Not configured` (recommended option: gitleaks plus GitHub secret scanning, added in M0). `.env*` files are git-ignored. Only `.env.example` with placeholder names is committed. Coding sessions do not read `.env` files. Names only below.

### 4.1 Secret names
Decided 2026-10-25 (recommended option approved: these names; M0 fixes the final list in `.env.example` with empty values). All are `Not configured`; none verified.

| Name | Used for | Browser-exposed |
|---|---|---|
| `DATABASE_URL` | App role | No |
| `DATABASE_URL_WORKER` | Worker role | No |
| `DATABASE_URL_MIGRATE` | Migration role, CI and deploy only | No |
| `AUTH_SECRET` or `BETTER_AUTH_SECRET` (per PRD 2) | Session signing | No |
| `APP_BASE_URL` | Callback origin | Public, not secret |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Sign-in (later Calendar) | Secret: No |
| `RETELL_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET` | Calls and webhook verification (provider per PRD 3) | No |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | SMS and signature validation | No |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | Email and webhooks | No |
| `LEAD_WEBHOOK_MASTER_SECRET` | Derive per-tenant lead secrets, if derived | No |
| `N8N_TOKEN_SIGNING_KEY` | Mint and verify tenant n8n tokens | No |
| `APP_ENCRYPTION_KEY` | Encrypt provider and OAuth tokens at rest | No |
| `APP_ENCRYPTION_KEY_VERSION`, `APP_ENCRYPTION_KEYS_RETIRED` | Key version for new ciphertext (default 1); older versions as `2:key,3:key` so rows can still be read until re-encrypted (DC-064) | No |
| `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET` | R2/B2 recordings and backups | No |
| `BACKUP_ENCRYPTION_KEY` | Encrypt `pg_dump` before upload | No. Stored apart from bucket credentials |
| `SENTRY_DSN` (optional) | Error reporting | Server-only anyway |
| `OUTBOUND_ENABLED` | Kill switch (3.9) | Config, not secret |
| `PROVIDER_MODE` | Selects live provider adapters or test fakes; `stub` requires outbound disabled | Config, not secret |

Existing Kynetic keys used by agency tooling are **not** reused. The portal gets its own keys, separate Twilio credentials where possible, and separate keys per environment.

### 4.2 Storage and rotation
- **Storage.** Production secrets live in the production host's environment (Docker secrets or an env file readable only by root and the service user), never in the repo, images or committed Compose files. Decided 2026-10-25 (recommended option approved: Docker secrets for v1; revisit at 25+ clients).
- **Encrypted per-tenant values** (OPM OAuth tokens, any tenant-specific provider credential): AES-256-GCM with a random nonce per value and the key ID stored with the ciphertext, so keys can rotate. The key comes from `APP_ENCRYPTION_KEY`; the ciphertext is bound to its tenant, provider and name, and `src/server/secrets/` is the only code that seals or opens it (DC-064). Decryption happens only in server code that needs it. No API returns values, including to admins, who see "set" and "last rotated" only.
- **Owner.** Abdullah.
- **Rotation.** Decided 2026-10-25 (recommended option approved: 90 days for API keys and signing secrets; immediately on suspected exposure, when someone with access leaves, or when a secret was committed even if reverted). A runbook is `Not configured`. Rotation cadence and escrow: PRD OD-n not listed; see Appendix B.
- **Exposure response.** Revoke at the provider first, rotate, redeploy, then clean history if needed. Record the date in `docs/known-issues.md` with no values.
- **Backups contain encrypted columns.** `BACKUP_ENCRYPTION_KEY` and `APP_ENCRYPTION_KEY` are kept apart from the backups, with an escrow copy for the restore drill (Decided 2026-10-25, recommended option approved: Abdullah's password manager).

### 4.3 Client exposure
- Only `NEXT_PUBLIC_*` variables reach the browser. Allowed values: app base URL, product name, build info. CI fails if a `NEXT_PUBLIC_` name contains `KEY`, `SECRET`, `TOKEN` or `PASSWORD` (SEC-T-19).
- Secrets are read only in server-only modules (`import "server-only"`).
- Provider keys, webhook secrets, signing keys, the raw Alex prompt and provider agent IDs never appear in pages, API responses, error pages or logs.
- Branding (F-39) exposes only logo, color and name.

---

## 5. Input and output handling

### 5.1 Validation
- Every route handler, server action and webhook handler parses input with a Zod schema at the boundary. Unknown keys are rejected, and types, lengths and enums are checked before the database is touched.
- Phone numbers are E.164, emails lowercased and validated, money in integer cents, timestamps UTC with a tenant timezone for display, IDs UUID.
- Field limits (Decided (recommended option approved): names 200 chars, notes 20,000, message body 1,600, custom text 2,000, 100 tags per contact, 50 custom fields per entity), defined once in shared constants.
- Custom field values (F-12): keys must exist in `custom_field_defs` for that tenant and entity, and values must match the declared type and options. Unknown keys are rejected so `custom jsonb` cannot become free storage.
- `limit` is capped (Decided (recommended option approved): 200). Sort and filter fields come from a per-table allowlist, including URL state from TanStack tables (F-05).
- Auth failures return generic errors. Validation errors list field paths only.
- **Error codes (final; CODE_STYLE defers to this list).** `UNAUTHENTICATED` (401), `FORBIDDEN` (403, role denied), `MODULE_DISABLED` (403, module off, F-70), `NOT_FOUND` (404, also returned for any cross-tenant id, 2.2 item 3), `VALIDATION_FAILED` (400), `CONFLICT` (409), `RATE_LIMITED` (429), `PROVIDER_ERROR` (502), `INTERNAL` (500). Webhooks: a module-off webhook is stored, acknowledged with 200 and marked `skipped`, not rejected (2.4). No other codes without amending this list.

### 5.2 Injection and XSS
- **SQL.** Drizzle with parameterized queries. Raw SQL only through Drizzle's `sql` template with bound parameters. String concatenation into SQL is banned by lint. Dynamic ORDER BY uses allowlists.
- **XSS.** React escapes by default. `dangerouslySetInnerHTML` is banned except in the one audited rich-text component for notes (F-22), which sanitizes on write and on render with an allowlist (basic formatting, lists, links with `rel="noopener noreferrer"`, mention spans). Scripts, event handlers, iframes, `javascript:` URLs and CSS are stripped.
- Transcripts, summaries, SMS and email bodies, lead fields and extracted fields render as plain text.
- **CSP.** Nonce-based, no `unsafe-inline` scripts, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`. Also HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`. Final values verified in M0 and M10 (`Not configured`).
- **Implemented (M0-21, DC-067).** `src/proxy.ts` sets the CSP with a per-request nonce plus `Strict-Transport-Security` (2 years, includeSubDomains), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy` (camera, microphone, geolocation, payment, usb off). Styles allow `'unsafe-inline'` for component-library inline style attributes; scripts do not. `unsafe-eval` is development only. Values are re-verified in M10.
- **CSV formula injection (F-38 export).** Cells starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with a single quote.
- **Email headers.** Subject and header fields are stripped of CR and LF. Branded sender name (F-39) is limited to safe characters. The sending domain is Kynetic's verified domain in v1; a custom sender is "Later" (PRD PRD 11 covers domains).
- **SSRF.** The server never fetches arbitrary URLs. Recording copies fetch only from allowlisted provider HTTPS hosts, with limited redirects, and private IP ranges are blocked.
- **Prompt injection (R7).** Lead text and transcripts may carry instructions aimed at an LLM. Rules: untrusted text is passed as data, never as system instructions. LLM output is schema-validated and never chooses tenants, IDs, URLs or SQL. Alex's booking and lookup tools are bound server-side to the tenant and the contact on that call. No tool lets the model send a message or start a call except through the compliance gate.
- **Open redirect.** Post-login `returnTo` accepts same-origin relative paths only.

### 5.3 Uploads
| Upload | Rule |
|---|---|
| CSV import (F-38) | `.csv` only. Decided 2026-10-25 (recommended option approved: 10 MB and 50,000 rows; the acceptance test imports 1,000). UTF-8. Parsed server-side. Mapping and preview before commit. Per-row errors reported in `imports.rows_failed`. Runs as a job in the tenant's RLS context. Consent columns need source and date (3.2). Owner only by default |
| Logo (F-39) | PNG, JPEG or WebP only. Max 1 MB. Dimensions capped. Re-encoded server-side to strip metadata. **SVG rejected.** Stored under the tenant prefix. Served with `nosniff` (Decided (recommended option approved): from a cookieless domain) |
| Note attachments (F-23, Later) | Not in v1. Before building: type allowlist, size cap, malware scan (`Not configured`), `Content-Disposition: attachment`, tenant-prefixed keys, signed URLs |
| Recordings | Not user uploads. Copied from providers on allowlisted hosts. Signed-URL access only |
| Anything else | No other upload endpoints in v1. Adding one requires updating this section |

Import files and logos are parsed or re-encoded, not served as-is, so malware scanning is not required for them in v1 (`Not configured`; revisit if client-side upload F-95 ships). Exports neutralize cells starting with `=`, `+`, `-` or `@` (F-38).

### 5.4 Rate limits and abuse (F-87)
The spec requires limits on login, webhooks and API, with no numbers. Decided 2026-10-25 (recommended option approved: the values below as starting points, tuned in M10 load testing). Layers: Cloudflare rules at the edge, plus in-app limits keyed by IP, user and tenant. Store: Decided 2026-10-25 (recommended option approved: Postgres-backed limiter, no Redis in the stack).

| Endpoint or action | Limit (decided, recommended option) | Response |
|---|---|---|
| Login, magic link request, invite accept | 5/min per IP; 10/hour per email | 429 with `Retry-After`; generic message, no enumeration |
| Authenticated API per user | 120/min | 429 |
| Lead webhook per `tenantKey` | 60/min and a daily cap | 429; alert if sustained |
| Provider webhooks | Published provider IP ranges where available; 600/min per source; failed-signature counts per IP | Cloudflare block after repeated bad signatures |
| CSV export and import | 5/hour per tenant | 429; audited |
| Search and Cmd+K (F-37) | 30/min per user | 429 |
| Outbound calls (Alex) | From `alex_configs.retry`, with a hard ceiling. Decided 2026-10-25 (recommended option approved: 3 per day and 6 per week per contact, regardless of config; plus a per-tenant hourly cap) | `rate_cap` deny, alert |
| Outbound SMS | Decided 2026-10-25 (recommended option approved: 3 per day per contact; per-tenant cap) | `rate_cap` deny |
| Impersonation start | 20/hour per staff user | 429, alert |

Repeated limit hits create a security event in F-62 and an alert. Alert channel: PRD has none; recommended option in Appendix B. Lockout is slowdown, not permanent account lock.

### 5.5 Cloudflare and cookies
Cookies per 2.1. Cloudflare: TLS 1.2 or higher, "Always HTTPS", managed WAF rules on, bot protection on. Current settings for this app: `Not configured`. The existing portal's settings are not a verified baseline.

---

## 6. Privacy, retention, environments, deployment

### 6.1 Data, purpose, retention, access
| Data | Purpose | Retention (decided, recommended option) | Access |
|---|---|---|---|
| Contact PII | Run the client's CRM and outreach | While the tenant is active. Exported or deleted on offboarding | Tenant roles per 2.2. Kynetic via view-as, audited |
| Call recording, transcript, summary, extracted fields | Show what Alex did; quality review | 12 months, then auto-deleted. PRD PRD 9 | Tenant roles; Kynetic via view-as |
| SMS and email records | Timeline and delivery | Follow call retention | Same |
| Consent records | Prove permission | At least 5 years after last contact. Survives contact deletion as minimal evidence: hashed number, channel, wording version, timestamps. Counsel (PRD PRD 9) | Admin; tenant owner sees their own |
| Audit log | Accountability | 24 months, append-only | Admin and VA read; never clients |
| Onboarding import files (F-90) | Re-run or audit an import | Raw file deleted 30 days after commit (decided, recommended option); batch row, counts and report kept for the life of the tenant; the file itself holds client PII and is access-limited to the admin who ran it | Kynetic admin only; never served to the browser |
| Imported contact records | Seed the client's CRM | Same as contact PII. Imported records carry `imported_source` and `import_batch_id`; imported contacts have no consent until evidence is mapped (F-96) | Tenant roles per 2.2 |
| `webhook_events.payload` | Replay and debugging | Purge payload after 30 days; keep ID and status | Worker; admin sees metadata only |
| User accounts | Login | While active; removed 30 days after deactivation unless audit needs them | Self; admin |
| IP addresses | Consent evidence, audit, rate limits | As consent or audit retention; rate-limit counters short-lived | Admin |
| `metrics_daily` | Dashboards | Life of tenant | Tenant |
| Backups | Recovery | 30 daily and 12 monthly (locked), then destroyed | Abdullah only |

- **Offboarding.** Spec: full tenant export and delete is Later. Until built, deletion is a manual runbook (`Not configured`) that Abdullah performs and records. Retention terms: PRD PRD 9.
- **Data subject requests** (a customer asks the client to delete their data). The client owner deletes the contact. That removes PII and recordings and keeps the DNC tombstone and minimal consent evidence (3.3). No self-serve tool in v1.
- **Roles.** Kynetic is the processor and the client is the controller of its customers' data. A data processing clause belongs in the client agreement (counsel).
- **No client data in Twenty and none in preview or dev** (locked decisions). Seed data is synthetic.
- **Least data.** Do not collect government IDs or payment card data. Quotes, invoices and payments are not in v1 (F-51).

### 6.2 Logging redaction and environments
**Never in logs, error reports, analytics or Sentry:** passwords, tokens, cookies and `Authorization` headers; API keys and webhook signing secrets; invite and magic-link tokens; full phone numbers (last four only) and email addresses (domain or hash); SMS and email bodies; call transcripts; recording URLs; lead form free text; full webhook payloads; `custom jsonb`; consent `captured_text` and IP. These redaction rules match `docs/CODE_STYLE.md`, which defers to this section.
- Redaction is configured centrally in the logger, with a test that fails if a fixture log line contains a banned field (SEC-T-18). Sentry, if enabled, scrubs bodies, cookies and headers before send.
- Logs carry `request_id`, `tenant_id`, `user_id` or `actor_id`, `module_key` and job or webhook IDs, but no PII.
- Log retention: Decided 2026-10-25 (recommended option approved: 30 days on the host; no offsite log shipping planned).

**Environments:**
| Environment | Data | Provider keys | Outbound |
|---|---|---|---|
| Local dev | Synthetic seed | Sandbox only | `OUTBOUND_ENABLED=false` |
| Preview (per branch or PR) | Synthetic seed, separate database | Sandbox only (Twilio test credentials, provider sandbox, Resend to a dev inbox) | `OUTBOUND_ENABLED=false`. The dispatch layer refuses any recipient not on a short allowlist of Kynetic test numbers |
| Production | Real tenants | Production keys, unique to prod | Per tenant, by module flags and the compliance gate |

- **Preview-only deploys until Abdullah approves** (locked decision). Coding sessions deploy to preview only. A production deploy, production migration, DNS or Cloudflare change, or enabling a provider webhook in production each needs Abdullah's explicit yes on that exact change.
- Merges use `--no-ff`, commits are authored as `abdullah-kynetic <abdullah@kyneticai.com>`, and `main` history is never rewritten (project rules).
- **Existing portal** (`portal.kyneticai.com`, OVH VPS) keeps running unchanged until Abdullah retires it. No data is migrated from it (F-88, decided 2026-10-25: it has only demo accounts). Whether the new app shares a host with n8n, Twenty or the existing portal: decided in Appendix B (separate compose project, own Docker network and database).
- Nora, Emily, Retell agent tools and the Kynetic Restoration demo records are never used as test data or targets (project hard rules).

### 6.3 Dependencies
- **Base.** Kiranism `next-shadcn-dashboard-starter` (MIT). M0 removes Clerk, demo pages and chat demos (spec section 11). Atomic CRM (MIT) is reference.
- **No AGPL code** (Twenty, EspoCRM, SuiteCRM, Frappe, NocoBase), copied or forked (locked decision). CI license check fails on AGPL or GPL dependencies. Tool: `Not configured` until M0.
- Lockfile committed; CI installs from it. Package manager: not stated in sources, `Not configured`.
- Automated update PRs and a vulnerability audit on every PR: `Not configured`. Decided 2026-10-25 (recommended option approved: weekly update PRs; critical advisories patched in 7 days, high in 30; each new dependency justified in its PR and checked for maintenance and license).
- Pin Docker base images by digest. Image scanning: Decided 2026-10-25 (recommended option approved: Trivy).
- No third-party scripts, analytics or tag managers in the portal without updating this file.
- Watch Next.js, React and Better-Auth (or Auth.js) advisories. Owner: Abdullah.

### 6.4 Backups and recovery (locked decisions, F-63)
- Nightly `pg_dump`, encrypted with `BACKUP_ENCRYPTION_KEY` before leaving the server, uploaded to offsite R2 or B2. **30 daily and 12 monthly** kept.
- The dedicated `kynetic_backup` login is `NOSUPERUSER NOCREATEROLE BYPASSRLS CREATEDB`; superuser bootstrap sets these attributes. BYPASSRLS is required to dump FORCE-RLS tables, and CREATEDB is required for an isolated scratch restore. It has read-only object grants on application tables and queue tables; it cannot write application data. The app and worker roles do not receive these attributes.
- **Monthly restore test** (locked decision): restore the latest backup into an isolated scratch database, run row-count and integrity checks, run the isolation tests (SEC-T-01, SEC-T-02) against it, and record the date and result. F-63 shows status, last test and a manual backup button (admin only, rate limited, audited).
- The M10 backup restore drill is the first formal drill. Where evidence is recorded: Decided 2026-10-25 (recommended option approved: an `audit_log` entry plus a dated note in `docs/progress.md`).
- A failed backup raises an alert. A backup older than 36 hours turns the admin card red.
- Storage credentials used by the backup worker permit object list, upload, readback verification, and retention deletes. They are separate from the backup encryption key; production credential scoping and lifecycle protection remain deployment configuration.
- RPO up to 24 h (nightly). RTO: Decided 2026-10-25 (recommended option approved: 4 hours). Point-in-time recovery is not in the spec; recommended option: defer until more than 5 paying clients.
- Local dump, authenticated encryption, upload/readback, scratch `createdb`/`pg_restore`/schema verification, and cleanup are implemented and exercised against disposable PostgreSQL in M8b. Production storage, credential scoping, and monthly live operations remain unverified.

### 6.5 Security-sensitive change review
Changes needing Abdullah's review before merge. CODEOWNERS and branch protection: `Not configured`. Decided (recommended option): add in M0 so GitHub enforces it.
1. RLS policies, DB roles, migrations touching policies or `tenant_id`.
2. Auth, sessions, `authorize()`, module guard.
3. The compliance gate, consent, STOP and DNC, quiet hours, recording disclosure.
4. Webhook routes, signature verifiers, the outbound dispatch layer.
5. Encryption, secrets, logging redaction, CSP and headers.
6. Impersonation, audit log, backups.
7. New dependencies, new upload endpoints, new external integrations.

A PR touching these must say so in its description and list its tests from section 7. Milestone ownership applies: a milestone thread that needs to change another milestone's security-critical code opens a request instead. Known-issue fixes outside scope go to `docs/known-issues.md`, not into the PR.
- The spec's "security review" is in M10. Decided (recommended option): also after each new provider integration and quarterly.
- Incident response: Decided 2026-10-25 (recommended option approved: a one-page runbook: contain with the kill switch and key revocation, assess affected tenants from the audit log, notify affected clients within 72 hours, record in known-issues). UNRESOLVED (needs counsel): notification duties by state. Runbook: `Not configured`.

---

## 7. Verification

Tests below go into `docs/TESTING.md` and run in CI (Vitest for unit and integration, Playwright for end-to-end, both named in M0). Test commands: `Not configured` until M0.

**Tenant isolation (M0; each milestone adds its tables)**
- SEC-T-01 Schema check: every table with `tenant_id` has RLS enabled, forced and at least one policy.
- SEC-T-02 SQL level: as the app role with tenant A set, SELECT on every tenant table never returns tenant B rows. With no tenant set, zero rows. An INSERT or UPDATE with another tenant's `tenant_id` fails.
- SEC-T-03 API level: for each resource, tenant A requesting tenant B's id gets `NOT_FOUND`, for read, update, delete and list, including search, Cmd+K, exports, reports and notifications.
- SEC-T-04 A pooled connection does not carry the previous tenant.
- SEC-T-05 App and worker roles are not owner, superuser or `BYPASSRLS` (check `pg_roles`).
- SEC-T-06 A job whose payload tenant mismatches its record is rejected.

**Permission denial (F-73)**
- SEC-T-07 Matrix test generated from 2.2: for each capability and role, allowed roles succeed and others are denied at the server.
- SEC-T-08 Client DTOs never contain `cost_cents` (v1), provider IDs, raw prompt or secrets.
- SEC-T-09 A deactivated user's session fails on the next request. A removed membership loses access immediately.
- SEC-T-10 Staff without export or bulk-delete toggles cannot call those endpoints directly.
- SEC-T-11 View-as: read-only blocks writes at the database; banner state present; audit rows carry `impersonator_id`; VA cannot enable write; forbidden actions (2.6) denied.

**Module gating (F-70)**
- SEC-T-12 For each module key: a tenant without it gets 403 `MODULE_DISABLED` on every owned endpoint, queued jobs skip at execution time, webhooks are acknowledged and ignored. A tenant with it works. Includes disabling a module with queued work. Includes `crm` at `lite` on a Full-only route.

**Compliance (F-74 to F-78)**
- SEC-T-13 No feature code imports a provider adapter; every call and SMS path goes through `canContact`.
- SEC-T-14 A replayed webhook (same source and external_id) is a no-op, including under concurrent delivery (F-77).
- SEC-T-15 Each deny reason (no consent, revoked, opted out, internal DNC, quiet hours, `sms_not_approved`, module off, paused, suspended) returns the right code and sends nothing. STOP revokes consent in the same transaction. Revocation between enqueue and send still blocks.
- SEC-T-16 Imported and third-party leads default to no consent; Alex and SMS not dispatched.
- SEC-T-17 Recording disclosure present in Alex config on save; save rejected without it; `calls` records the version played (F-75).
- SEC-T-18 Log redaction: fixtures with phone, email, token, transcript and webhook payload come out redacted.
- SEC-T-21 Quiet hours with an injected clock across timezones and DST boundaries.
- SEC-T-22 Per-contact and per-tenant caps stop a runaway retry loop.
- SEC-T-23 `OUTBOUND_ENABLED=false` blocks real dispatch in preview and local, and when toggled in production.

**Webhooks and service access (F-76, F-77, F-89)**
- SEC-T-20 Every route under `/api/hooks/*` and `/api/service/*` has a verifier (startup and CI check). Missing, invalid, expired-timestamp and wrong-tenant signatures return 401 and write nothing.
- SEC-T-24 n8n tokens are tenant-scoped; tenant A's token cannot act on tenant B; a revoked token gets 401.
- SEC-T-25 Booking tool creates appointments only within business hours, only for the call's contact, and only for the mapped tenant (F-78).
- SEC-T-26 Rate-limited webhook floods return 429 and failed-signature floods write nothing to `webhook_events` (F-87).

**Input, output and secrets**
- SEC-T-27 Zod rejects unknown fields, oversize payloads and bad enums. Sort and filter outside the allowlist rejected. Unknown custom field keys rejected.
- SEC-T-28 SQL injection payloads in search, filter and import values are handled as data.
- SEC-T-29 Stored XSS payloads in notes, names, lead fields and transcripts do not execute (Playwright). Sanitizer allowlist test.
- SEC-T-30 CSV export neutralizes formula-leading cells. Oversize or malformed CSV rejected without partial commit.
- SEC-T-31 Logo upload rejects SVG, MIME and extension mismatches, and oversize files.
- SEC-T-32 Open redirect and CSRF (missing or foreign Origin) rejected.
- SEC-T-19 No `NEXT_PUBLIC_` name contains KEY, SECRET, TOKEN or PASSWORD. The built client bundle is scanned for dummy secret values in CI.
- SEC-T-33 Secret scanning in CI detects a planted dummy secret.
- SEC-T-34 Encrypted columns are ciphertext in the database; API responses never contain decrypted provider tokens.
- SEC-T-35 Audit rows written for logins, writes, exports, impersonation, module and role changes, with before and after. The app role has INSERT and SELECT only on `audit_log`.
- SEC-T-36 Monthly restore test runs against a scratch database, then SEC-T-01 and SEC-T-02 pass against the restored copy.

### 7.1 Residual risks and owners
| # | Risk | Owner | Status |
|---|---|---|---|
| R1 | A compromised Kynetic admin account reaches every tenant | Abdullah | Mitigated: Google allowlist plus mandatory TOTP (F-98, 2.1), audit log, impersonation limits |
| R2 | Legal wording, state quiet hours, two-party recording states, DNC scrub and consent basis for third-party leads not settled. This file is not legal advice | Abdullah, with counsel | Open |
| R3 | A2P campaign not approved: no SMS in production | Abdullah (Twilio thread) | Open. SMS gated off (3.7) |
| R4 | Cloudflare origin lock-down and host hardening `Not configured`. Shared VPS risk with n8n, Twenty and the existing portal | Abdullah | Open |
| R5 | Backups hold deleted data for up to 12 months | Abdullah | Accepted (Decided 2026-10-25); must appear in client agreement |
| R6 | Provider-hosted recordings reachable by long-lived URLs | Abdullah | Mitigated by copying to tenant storage (2.3 item 10) |
| R7 | LLM summaries or extractions may carry injected text | Milestone owners M4 and M6 | Mitigated by 5.2 |
| R8 | Third-party OAuth tokens for `opm` raise the impact of a database leak | Abdullah | Encrypted; minimum scopes; `opm` built last |
| R9 | Existing n8n workflows and legacy tooling have unauthenticated webhooks (KI-005) | Abdullah | Outside this app; this app's outbound events to n8n are only as safe as those workflows |

---

## Appendix A. Feature IDs used in this file

| ID | Feature | Where cited |
|---|---|---|
| F-01 to F-03 | Results, trends, guarantee | 2.4 |
| F-05, F-06, F-07, F-08 | Contacts list, contact page, create and edit and dedupe, bulk actions | 2.2, 3.2, 3.3 |
| F-12 | Custom fields | 5.1 |
| F-19 | Activity timeline (every allow and deny writes here) | 3.1 |
| F-22, F-23 | Notes (rich text and mentions); attachments (Later) | 2.2, 5.2, 5.3 |
| F-24 to F-29 | Calendar, call list, call detail, flag call, call cost | 2.2, 2.4 |
| F-30 | SMS and email log | 2.4 |
| F-31 to F-33 | Automation templates, sequences, stage moves | 2.2 |
| F-35, F-36 | Notifications and preferences | 2.2 |
| F-37 | Search and Cmd+K | 5.4 |
| F-38 | CSV import and export | 2.2, 5.2, 5.3 |
| F-39 | Branding | 4.3, 5.2 |
| F-41, F-42, F-43 | Business settings and team; Alex client settings; pipelines, fields, tags | 2.2, 3.5 |
| F-46, F-47 | Public booking page (Later); two-way inbox (Later) | 2.4, 3.7 |
| F-48 | Reviews (mapped to `opm` if PRD 7 accepts) | 2.4 |
| F-49, F-50, F-51 | ROI report; custom report builder (Later); quotes and invoices (Later) | 2.4, 6.1 |
| F-53 to F-55 | All clients; health score; onboarding | 2.2, 2.3 |
| F-57 | View as client | 2.3, 2.6 |
| F-58, F-59 | Per-client Alex config; prompt versioning (Later) | 2.2, 3.5 |
| F-60 to F-63 | Audit log; user management; integration health; backups | 2.2, 2.3, 5.4, 6.4 |
| F-66 to F-69 | Phase 2 billing, goal tracker, email templates, audit tool link | Out of scope for this file |
| F-70 | Module switching per tenant | 2.4 |
| F-71 | Secure sign-in | 2.1 |
| F-72 | Tenant isolation | 2.3 |
| F-73 | Role-based access | 2.2 |
| F-74 | TCPA-safe contact | 3 |
| F-75 | Recording disclosure | 3.5 |
| F-76 | Lead source webhook | 3.6 |
| F-77 | Webhook idempotency | 3.6 |
| F-78 | Alex speed-to-lead and booking | 3.4, 3.6 |
| F-79 to F-84 | Upsell backends (quote follow-up, after-hours, text-back, reactivation, OPM, bundle) | 2.4, 3.8 |
| F-85 | CRM tier (Lite or Full) | 2.4 |
| F-86 | Tenant tier and plan recorded | 2.4 (Lite and Full routes) |
| F-87 | Secrets and abuse limits | 4, 5.4 |
| F-88 | Clean launch; synthetic demo tenant only | 6.2 |
| F-89 | n8n service token and events | 2.3, 3.6 |

## Appendix B. Decisions and open items

All PRD decisions below were approved by Abdullah on 2026-10-25 (cite them, do not re-ask):
- **PRD 1** Base portal for every tenant; CRM Lite and Full are paid upsells. Used in 2.4.
- **PRD 2** Better-Auth, Google plus magic link, admin 2FA in v1 (F-98). Used in 2.1.
- **PRD 3** ElevenLabs primary, Retell fallback. Affects 4.1 and 3.6.
- **PRD 4** Drizzle, pg-boss, Resend confirmed.
- **PRD 5** No migration of existing portal users; clean launch, synthetic demo tenant.
- **PRD 6** Upsell backends in M7; OPM is M11 (F-79 to F-84, F-89).
- **PRD 7** Follow-up bundle contents; F-48 belongs to `opm`. Used in 2.4.
- **PRD 8** Clients edit pause and call hours only. Used in 2.2.
- **PRD 9** Retention and offboarding. Used in 3.5, 6.1.
- **PRD 10** Health score weights and guarantee target.
- **PRD 11** One portal domain. Used in 5.2.
- **PRD 12** Founding pricing $6,500 setup + 3 months, then $1,500/mo (the $4,675 figure is dropped).
- **PRD 13** WCAG 2.2 AA and the performance numbers. The "within 60 seconds" promise yields to quiet hours (3.4).
- **PRD 14** D-007 governs Kynetic's own prospecting; Alex calling a client's own inbound leads is allowed through the compliance gate. Used in 3.
- **PRD 18** Quiet hours 08:00 to 21:00 lead-local, stricter state rules on top.

Raised in this file, decided 2026-10-25 (recommended option approved) unless marked UNRESOLVED:
- Quiet-hours window (3.4): decided. State overrides: UNRESOLVED (needs counsel).
- Consent wording (3.2): UNRESOLVED (needs counsel). The Cal.com consent checkbox and the Terms line follow the counsel-reviewed wording.
- Twilio registration model per client (3.7): Kynetic registers on the clients' behalf where Twilio allows; UNRESOLVED (needs Twilio) until the A2P campaign is approved.
- DNC registry scrub (3.3, 3.8): required before reactivation; UNRESOLVED which vendor or registry (needs outside information).
- Two-party recording states (3.5): disclosure on every call; the state list is versioned config, UNRESOLVED (needs counsel).
- Rate-limit numbers and limiter store (5.4): the numbers in 5.4 are the v1 defaults; the limiter store is Postgres.
- Alert channel for security and backup events (5.4, 6.4): email via Resend.
- Secret rotation cadence, secret store and escrow (4.2): as written in 4.2.
- Host (6.2): separate compose project, own Docker network and database on the OVH VPS; a separate VM is Later.
- Impersonation write mode (2.6): admin only, reason required, 30 minutes.
- Incident response runbook (6.5): one-page runbook as written; state notification duties UNRESOLVED (needs counsel).

## Appendix C. Contradictions

- **C1 Auth library.** Spec names Better-Auth; decisions allow Better-Auth or Auth.js. Resolved: Better-Auth (PRD 2).
- **C2 Sign-in methods.** Spec stack adds email magic link; decisions say Google. Resolved: both (PRD 2).
- **C3 CRM as module vs base product.** Decisions list "CRM build-out (Lite/Full)" as a priced, toggleable module. Resolved (PRD 1): the base portal (leads, kanban, appointments, calls, reports) is for everyone; the `crm` module (Lite/Full) is the paid upsell, which is how this file gates it.
- **C4 Twenty and Phase 2.** Spec Phase 2 has the same codebase replace Twenty for Kynetic's own pipeline. Decisions keep Twenty internal and client data out of it. Compatible only if Kynetic's pipeline sits outside client tenants (Appendix A, F-65 to F-69).
- **C5 Voice provider.** Spec leaves Retell or ElevenLabs open; Kynetic project notes record ElevenLabs as chosen (Oct 22), reversing D-018, with ElevenLabs primary and Retell fallback (PRD 3). Verifiers in 3.6 cover both.
- **C6 Per-call cost.** Spec and decisions say Later. Consistent. Hidden from clients in v1.
- **C7 Restore test timing.** Locked decisions require a monthly restore test; the spec's acceptance test mentions a drill only at M10. This file follows the decision.
- **C8 "Within 60 seconds" vs quiet hours.** Product promise conflicts with calling windows (3.4). Resolved: the promise yields to quiet hours.
- **C9 `external_id` uniqueness.** Spec says unique; with multiple providers, uniqueness on (source, external_id) is safer (3.6). DATABASE.md reconciles.
- **C10 Spec `consents` table** lacks a per-tenant DNC list, contact timezone field and disclosure version, which 3.3 to 3.5 need. DATABASE.md reconciles.
- **C11 VA access.** Spec gives VAs read-only view-as and also "edit contacts or tasks on request". Resolved in 2.6 by a separate logged support-edit action.
- **C12 Hard rules vs product.** Hard rules say outreach is phone-only and by a human, with no AI cold calls or cold SMS. The product contacts leads by AI voice and SMS. Reconciled by limiting to consented, inbound-requested leads (3.1 to 3.8). Reactivation (3.8) is the edge case and is gated by consent, DNC and quiet hours. PRD 14.
- **C13 Module-off status.** Spec says UI hidden; PRD F-70 and CODE_STYLE say 403 on the server. Both are followed: UI hidden and server 403 (2.4).

## Appendix D. Gap-check additions (2026-10-25)
Approved by Abdullah 2026-10-25 (GP-01 to GP-05). The Terms and Privacy wording still needs counsel.
- **F-99 billing profile.** Kynetic admin only: read and write. VA, owner and staff get 403. Stripe customer id is an identifier, not a secret; no card data is ever stored. Every write is audited with before and after.
- **F-100 setup checklist.** Admin and VA read and write; owners read only steps flagged `client_visible`, with no vendor ids, credentials or internal notes.
- **F-101 operations tools.** Admin only, except webhook viewer and job viewer which VAs may read. Kill switch, replay, retry, suspend and 2FA reset are admin-only, audited, and rate limited (5.4). Replay goes through the same idempotent path as the first delivery and re-checks module and compliance state. The kill switch is checked by `OutboundGate` before every call or text, so a queued job cannot slip past it.
- **F-102 terms acceptance.** Stored per user with version, time and IP. The acceptance page is the only route allowed before acceptance. The wording is UNRESOLVED (needs counsel).
- **F-103 documents.** Upload by admin only; PDF only, size limit 10 MB, magic-number check, stored under the tenant prefix; owners download by a signed URL that expires in 5 minutes after `authorize()`. Another tenant's id returns 404.
- **Branding inputs (F-39).** Logo upload follows 2.x upload rules (type, size, re-encode); primary color must pass the contrast rule in DESIGN_SYSTEM before it is saved.
- **Preview environments** carry synthetic data only and sit behind Cloudflare Access.

### M12-03 evidence endpoint (2026-11-01; local implementation)

`POST /api/service/contact-decisions` uses existing tenant-scoped service authentication with `contact-decisions:write`. It records n8n's claim as evidence only; SECURITY 3.1 and OutboundGate still enforce sends. Strict v1 payload contains a contact ID, channel (`phone_call`, `sms`, `email`), allow/deny, bounded rule/reason identifiers and UTC timestamps. Tenant comes exclusively from the token. Foreign/deleted/merged contacts are 404. Exact retries yield the original ID; changed payload under the same event ID returns 409. The ledger and activity are atomic; runtime roles cannot update/delete ledger rows. This base-platform logging remains available to record module-off denials. It sends nothing, changes no consent and emits no trigger event. No new login/auth work is included.

### M12-05 admin lead-webhook issuance (2026-11-01)

The lead signing secret is the sole one-time-display exception to status-only secret reads: a verified Kynetic admin may issue/rotate it at `/admin/clients/{tenantId}/webhooks`. This does not reveal any previously stored value or any provider credential. Existing TOTP/admin checks and view-as denial apply on the action and page; active admin role is rechecked in the service. AES-GCM storage and value-free audit commit atomically using the worker connection. The browser receives the new value once, keeps it only in component memory and can dismiss it. Old signatures fail immediately after rotation. No automatic n8n configuration or activation. Real issuance/rotation still needs Abdullah's yes.

### M13-02 live voice opt-in (2026-11-01)

Credentials alone cannot select the real ElevenLabs adapter. `ELEVENLABS_LIVE_ENABLED=false` is the default; explicit true plus live provider mode is required. Existing consent and outbound controls remain. Stub mode overrides the flag. Production live mode with the flag absent/false fails closed rather than falling back to fake-signature verification. The deployment env template records false; real configuration/calls still require Abdullah's specific yes.

### M12-04/M12-06 read-only policy inputs (2026-11-01)

Send-state/contact-policy routes require separate least-privilege tenant bearer scopes and no-store responses. Configuration reads fail closed for absent/malformed platform state; snapshots read the current tenant state on each request. Contact data is RLS scoped, and foreign/deleted/merged contacts return 404. Consent evidence is represented by status/timestamps/source and an evidence-present boolean, not wording/IP/phone/email. Reads create no timeline or send job. Global environment disable and the existing per-tenant kill flags remain the actual portal controls; the admin global toggle currently updates existing tenant flags. No new global storage or change to OutboundGate is introduced. The snapshot explicitly reports migrationGatePassed=false until n8n/parity/owner review gates are implemented; a readable snapshot does not authorize contact.

### M13-03 normalized result relay (2026-11-01)

The call-result route authenticates a tenant service token with `calls:write`, requires alex_core, validates a strict bounded v1 schema, and checks both contact ownership and the agent/provider mapping inside that tenant. Foreign contact/agent/storage reference returns 404; disabled module returns 403 with no write; wrong/revoked scope returns 401. Caller-supplied tenant IDs and external recording URLs are rejected. Only a recording object key matching `<tenant>/calls/<safe-segment>/recording` may be attached; existing read authorization and five-minute signed URLs control playback. The route performs no fetch/provider call.

Concurrent retries share tenant event and provider-call locks, and an immutable receipt checks the full validated-body hash. Exact replay returns 200 duplicate; changed body/event identity for the same call returns 409. A call completed by the native path is not silently overwritten by the relay. Receipt failure rolls back call/activity/event/DNC effects. Existing native verification and tenant-agent resolution remain intact. An operational single-ingestion-path decision and real provider/n8n tests are still required before live cutover.

Unexpected call-result persistence errors log a fixed message and tenant ID only. Raw database error objects are not logged or serialized by this route because they may contain transcript/summary SQL parameters; a forced-failure integration test verifies that boundary.

### M16 synthetic agency workspace (2026-11-01)

Agency setup/reads require a current Kynetic admin, rechecked in the SECURITY DEFINER registry function; VA, client, disabled admin, impersonation and read-only contexts are rejected. Agency feature reads/writes require CRM Full and resolve the tenant from the agency registry. Normal tenant RLS protects contacts/deals/stages. The registry cannot be forged through app/worker table writes. Actions and page recheck existing access/view-as guards; no new login/auth functionality is added.

This first workspace is synthetic only: it starts with platform outbound disabled and Alex paused, no invites, memberships, credentials or integrations. The lead form accepts fictional names and @example.test email addresses only. Direction/channel combinations are validated server-side. Adding leads records no consent, emits no lead.created, and calls no send/provider helper. Stage moves/renames use existing audit/timeline behavior; Lost requires the user's reason. Repeated setup never resets customized stages or existing data. No live tenant was created in this session.

### M16 manual dialer safeguards (2026-11-01)

The synthetic queue excludes protected AM-1 identity/office number (D-016), active contact/number DNC, current phone opt-out/revocation, Florida/Oklahoma in either state/region field, missing/conflicting state, missing/non-synthetic numbers, non-cold-call sources, closed deals and previously logged first-pass leads. Alternate numbers are checked. The logger rechecks current database values after locking the contact. A committed event replay reads its original receipt and creates no new history.

The UI has no tel link, calls no provider and creates no AI calls row/send job. Human logging does not require or grant AI-call consent. DNC can be marked without asserting a call occurred; a DNC outcome applies existing number/contact/phone+SMS protections atomically. Audit/timeline contain IDs/outcomes rather than phone or operator notes. Current admin/TOTP/view-as guards, active-admin registry recheck and CRM Full gate protect all actions; tenant identity never comes from the form. Scripts/notes are untrusted plain text. These controls are not authorization for live agency data or real calls.

### M17-01 internal proposal drafts — 2026-11-01

Proposal reads and writes reuse existing admin/TOTP, no-view-as, active-admin and CRM Full checks in the synthetic agency workspace. Clients and VAs cannot access them; foreign deal/draft IDs return NOT_FOUND. Strict input validation rejects status/tenant overrides. Plain-text rendering escapes HTML-like content; error responses and logs exclude raw draft-bearing database errors. Audit records contain IDs, revisions and changed field names, never draft bodies. There is no public preview, send or publish action.

### Session enforcement restored on dev/codex-setup (2026-11-04)

Per Abdullah's explicit instruction, anonymous requests never select a default persona. `getVerifiedSessionUser` verifies the signed Better Auth session cookie against the existing server-side session store, checks expiry, current user/role/disabled state, staff lifetime and session-level second-factor verification. Cookie session caching is disabled. `/admin` and `/api/admin` reject missing sessions with HTTP 401 and insufficient roles/second-factor state with HTTP 403 in the Next proxy before rendering, including prefetch requests; layout and route/action guards retain their own checks.

`DEV_PERSONA_SWITCHING` defaults false and is forced false for `NODE_ENV=production`, even when configured true. In non-production it permits only an already authenticated, second-factor-verified Kynetic admin to preview an explicitly selected existing persona. Missing, malformed, unknown or unavailable selections never fall back to admin or another role. The `/open/[persona]` endpoint and menu are disabled without this flag. Admin authorization always uses the verified real session, independent of persona previews.

The initial dev change restored verification only. The approved main-merge follow-up below restores the missing sign-in and second-factor flows; anonymous access still fails closed. No production setting or deployment is changed by merging source.

### Sign-in restoration before the approved main merge (2026-11-04)

Restored the existing invitation-only Better Auth issuer, Google sign-in for allowlisted staff, single-use magic links for invited clients, PostgreSQL auth rate limits, staff TOTP/recovery-code setup and verification, and reset helper. `/sign-in`, `/api/auth/[...all]` and `/staff/2fa` are restored. The issuer and strict verifier use the same signed session-cookie name and database role/schema; the verifier still rejects disabled/revoked/expired sessions and does not trust client persona claims. Staff dashboard requests are redirected to TOTP until verified. Google/Resend configuration must be supplied through environment variables; no provider messages or production login are exercised by the local tests.

The Node boot email wiring registers the existing transactional sender without sending a message. Magic-link URLs are HTML-escaped and hashed for idempotency, never logged; tests capture the callback or use fake fetch. Main merge authorization is source-only and preserves the separate explicit VPS-deployment handoff.
