# Decisions log

Dated log of every decision for the Kynetic Client CRM & Portal. Newest entries go at the bottom of each section. Each entry has an ID, the date, who decided, the decision, and the docs it touches.

Rules:
- A PR that changes a decision adds an entry here and updates the affected docs in the same PR (see `AGENTS.md`).
- Entries are never deleted. A changed decision gets a new entry that says `Supersedes DC-nnn`, and the old entry is marked `Superseded by DC-nnn`.
- "Explicit" means Abdullah decided it in his own words. "Recommended option approved" means he told us to take the recommended option. "Proposal" means not yet approved.
- `DECISIONS_locked.md` and the spec are in `docs/source/`. `DECISIONS_locked.md` (Oct 25, 2026) wins over the spec. This log records decisions made in the docs process on top of both. The PRD "Decisions log" holds the same product decisions in its own numbering ("PRD decision n").
- Repo-level D-numbers (the Kynetic AI decision log) are assigned by Abdullah, not here.

## Locked before the docs process (source: DECISIONS_locked.md and project memory)

| ID | Date | Decision | Source | Docs |
| --- | --- | --- | --- | --- |
| DC-001 | 2026-10-25 | Every Kynetic system and upsell is a per-tenant toggleable module with its own backend. Module off: UI hidden, server returns 403, jobs no-op, data kept. | DECISIONS_locked | PRD, ARCHITECTURE, SECURITY |
| DC-002 | 2026-10-25 | Stack: Next.js 16, React 19, Tailwind 4 (Kiranism starter, MIT), Postgres 16 with row-level security per tenant, Docker on Abdullah's server with Cloudflare in front. Clerk and the starter's chat and demo pages are removed. | DECISIONS_locked | ARCHITECTURE |
| DC-003 | 2026-10-25 | Twenty CRM stays Kynetic-internal and holds no client data. No AGPL code. | DECISIONS_locked | ARCHITECTURE, PRD |
| DC-004 | 2026-10-25 | Roles: Kynetic admin, Kynetic VA, client owner, client staff. | DECISIONS_locked | SECURITY, DATABASE |
| DC-005 | 2026-10-25 | Nightly encrypted offsite backups, 30 daily and 12 monthly kept, monthly restore test. | DECISIONS_locked | ARCHITECTURE, SECURITY |
| DC-006 | 2026-10-25 | Deploys are preview-only until Abdullah approves; merges use a merge commit; secrets are never printed or committed. | DECISIONS_locked | AGENTS, CODE_STYLE |
| DC-007 | 2026-10-25 | Text-back is free with after-hours. Billing automation is Phase 2 (Later). | DECISIONS_locked | PRD |
| DC-008 | 2026-10-22 | ElevenLabs chosen as Alex's voice platform (bake-off). | Abdullah, memory | ARCHITECTURE |
| DC-009 | 2026-10-23 | Rebrand replaces purple everywhere: light-first, burnt orange #D9662A, espresso #1C1916 bands, champagne gold, Cormorant Garamond + Inter, no gradients or glows. | Abdullah, memory | DESIGN_SYSTEM |
| DC-010 | 2026-10-21 | Canonical n8n is the self-hosted VPS instance. | Abdullah, memory | ARCHITECTURE |

## Docs process, 2026-10-25 (Abdullah)

| ID | Date | Decision | Basis | Docs |
| --- | --- | --- | --- | --- |
| DC-011 | 2026-10-25 | Onboarding data import is a v1 feature (F-90 to F-97): CSV and Excel upload, field mapping, preview, dedupe on phone and email, dry run, history, undo of a whole batch, source and batch tags, admin-run during onboarding. | Explicit | PRD, DATABASE, ARCHITECTURE, SECURITY, TESTING |
| DC-012 | 2026-10-25 | Existing portal users: none. Clean launch, no migration. Demos use a seeded synthetic demo tenant and never real CRM records. | Explicit | PRD F-88, DATABASE, SECURITY |
| DC-013 | 2026-10-25 | Commits are authored only as `abdullah-kynetic <abdullah@kyneticai.com>`, with no AI co-author trailer and no "Generated with" footer. | Explicit | AGENTS, CODE_STYLE |
| DC-014 | 2026-10-25 | Auth: Better-Auth with Google sign-in and email magic links. | Explicit (PRD 2) | PRD, SECURITY, ARCHITECTURE |
| DC-015 | 2026-10-25 | Clients can edit only pause Alex and call hours. Everything else is a request to Kynetic. The raw prompt is never shown. | Explicit (PRD 8) | PRD, SECURITY, DATABASE |
| DC-016 | 2026-10-25 | Quiet hours are 8am to 9pm in the lead's local time, with stricter state rules layered on top. The 60-second speed-to-lead promise yields to quiet hours. | Explicit (PRD 18) | SECURITY, PRD, TESTING |
| DC-017 | 2026-10-25 | Admin 2FA (TOTP for Kynetic admin and VA) is in v1 as F-98, not Later. | Explicit | PRD, SECURITY, TESTING |
| DC-018 | 2026-10-25 | Online Presence Management is its own milestone, M11. M8 is split into M8a and M8b. | Explicit (PRD 6) | PRD, ARCHITECTURE, AGENTS |
| DC-019 | 2026-10-25 | Twenty push of tenant summaries is not built in v1. If built later it carries no client personal data and gets an F-ID then. Superseded by DC-043. | Explicit (PRD 16) | PRD, ARCHITECTURE |
| DC-020 | 2026-10-25 | Founding price: $6,500 setup plus 3 months, then $1,500/mo, with 25% off add-on setup fees. The older $4,675 figure is dropped. Updated by DC-049. | Explicit (PRD 12) | PRD, TESTING |
| DC-021 | 2026-10-25 | Accessibility target is WCAG 2.2 AA. | Explicit (PRD 13) | PRD, DESIGN_SYSTEM, TESTING |
| DC-022 | 2026-10-25 | Design proposals approved: success green (light #1E7A46, dark #6FBF8E) and the stronger input border token. | Explicit | DESIGN_SYSTEM |
| DC-023 | 2026-10-25 | Import limits and rules: `.csv` and `.xlsx` up to 10 MB and 50,000 rows; duplicates skipped by default with an optional fill-blanks merge; undo lists records edited after import instead of removing them; admin-only in v1; raw files deleted 30 days after commit. | Explicit (PRD 17) | PRD, DATABASE, SECURITY, TESTING |
| DC-024 | 2026-10-25 | Every remaining proposal takes the recommended option; only items that need outside information stay UNRESOLVED. | Explicit | all |
| DC-025 | 2026-10-25 | ElevenLabs is the primary voice provider; the Retell adapter stays as a fallback. Abdullah assigns the repo D-number. | Recommended option (PRD 3) | ARCHITECTURE, SECURITY |
| DC-026 | 2026-10-25 | Drizzle ORM, pg-boss and Resend are confirmed. | Recommended option (PRD 4) | ARCHITECTURE, CODE_STYLE |
| DC-027 | 2026-10-25 | `followup_bundle` = `quote_followup` + `reactivation` + `missed_call_textback`. The spec's "Reviews add-on" is part of `opm`. | Recommended option (PRD 7) | PRD, ARCHITECTURE |
| DC-028 | 2026-10-25 | Retention: recordings and transcripts 12 months then deleted (call row kept); messages 24 months; consent records 5 years after revocation; audit log 24 months; webhook payloads 30 days. On client exit the owner can export and Kynetic deletes the tenant after a 30-day grace period (manual runbook in v1). | Recommended option (PRD 9) | PRD, DATABASE, SECURITY |
| DC-029 | 2026-10-25 | Health score: five inputs at 20% each; green at 70 or more, yellow 40 to 69, red below 40. Guarantee target and start date live on `tenants`. | Recommended option (PRD 10) | PRD, DATABASE |
| DC-030 | 2026-10-25 | One domain, portal.kyneticai.com, for everyone. Per-client subdomains are Later (F-40). | Recommended option (PRD 11) | PRD, ARCHITECTURE |
| DC-031 | 2026-10-25 | D-007 ("phone only, by a human") governs Kynetic's own prospecting. Alex calling a client's own inbound leads is allowed, subject to consent, DNC, quiet hours and the compliance gate. Abdullah can overrule at any time. | Recommended option (PRD 14) | PRD, SECURITY |
| DC-032 | 2026-10-25 | Metric definitions: leads received, speed-to-lead (median seconds), contact rate, booking rate, revenue recovered (Won deal value with an Alex call or booking).  Reopened by DC-044; now a proposal only. | Recommended option (PRD 15) | PRD, TESTING |
| DC-033 | 2026-10-25 | Performance targets: mobile LCP at or under 2.5 s at p75; list API reads under 500 ms at p95 with 10,000 contacts; search under 500 ms at p95. | Recommended option (PRD 13) | PRD, TESTING |
| DC-034 | 2026-10-25 | Hosting: separate Docker Compose project on the OVH VPS with its own network and database; Caddy; a separate VM is Later. Recordings are copied to R2 and served by signed URL; backups go to R2. | Recommended option | ARCHITECTURE, SECURITY |
| DC-035 | 2026-10-25 | Sequences run in pg-boss inside the app; n8n runs cross-system workflows through the service API. | Recommended option | ARCHITECTURE |
| DC-036 | 2026-10-25 | Baseline migration model: M0 creates every table; later milestones add only additive migrations. RLS is ENABLE plus FORCE on every tenant table; staff cross-tenant reads go through SECURITY DEFINER roll-ups owned by the NOLOGIN `kynetic_rollup` role. Session variables: `app.tenant_id`, `app.user_id`, `app.role`, `app.impersonator_id`, `app.read_only`. | Recommended option | DATABASE, ARCHITECTURE, SECURITY |
| DC-037 | 2026-10-25 | Impersonation write mode: admin only, reason required, 30 minutes. Alert channel is email through Resend. | Recommended option | SECURITY |
| DC-038 | 2026-10-25 | One thread owns one milestone; AGENTS.md rules (module gating, import rule, commit rule) stand. | Recommended option | AGENTS |
| DC-039 | 2026-10-25 | In-portal add-on teaser: none in v1. Gated UI is hidden when off. | Recommended option | DESIGN_SYSTEM, PRD |
| DC-040 | 2026-10-25 | Dark mode ships in v1 with default light. Sidebar is an espresso band with the logo on a cream chip. | Recommended option | DESIGN_SYSTEM |
| DC-041 | 2026-10-25 | **Alex-only clients get the base portal**: leads, pipeline kanban, appointments, Alex call logs and reports (plus messages log, notifications, settings). **CRM Lite and CRM Full are paid upsells toggled per tenant on top of that.** M0 builds the base portal shell and the module mechanism so Lite and Full ship as gated modules. Lite adds companies, tasks, notes, configurable stages and settings pages; Full adds custom fields, bulk actions, multi-contact deals, search and Cmd+K, export and sequence enrollment. Supersedes the earlier recommended option in PRD decision 1 (read-only Leads list for Alex-only tenants). The Lite/Full split was approved as proposed (DC-046). | Explicit (PRD 1) | PRD, ARCHITECTURE, DATABASE, SECURITY, DESIGN_SYSTEM, TESTING, AGENTS |
| DC-042 | 2026-10-25 | `canContact` signature is `canContact(ctx, contactId, channel, now, opts?: { purpose? })`. `ctx` carries the tenant, so the tenant is not passed separately; the contact is loaded inside. Purpose is an optional field, not a positional argument. Supersedes the `(ctx, contactId, channel, purpose, now)` form in SECURITY and DATABASE and the `(tenant, contact, channel, purpose, now)` form in ARCHITECTURE. | Explicit (Abdullah, 2026-10-25) | ARCHITECTURE, SECURITY, DATABASE, CODE_STYLE |
| DC-043 | 2026-10-25 | Twenty push is Later, not v1. Client data never goes into Twenty; Twenty stays Kynetic-internal only. Supersedes DC-019. | Explicit (Abdullah, 2026-10-25; PRD 16) | PRD, ARCHITECTURE, TESTING |
| DC-044 | 2026-10-25 | Metric definitions (PRD decision 15) are reopened: UNRESOLVED, Abdullah decides before M6 starts. The PRD formulas are a proposal only. Supersedes DC-032. Superseded by DC-048. | Explicit (Abdullah, 2026-10-25) | PRD, ARCHITECTURE, DATABASE, TESTING, AGENTS, BUILD_PLAN |
| DC-045 | 2026-10-25 | F-71 cites SECURITY 2.1 as where Better-Auth sign-in, magic links and sessions are defined; PRD and SECURITY stay in sync. | Explicit (Abdullah, 2026-10-25) | PRD, SECURITY |
| DC-046 | 2026-10-25 | The Lite/Full split is approved as proposed. Lite adds companies, tasks, notes, configurable stages and settings pages; Full adds custom fields, bulk actions, multi-contact deals, search and Cmd+K, export and sequence enrollment. | Explicit (Abdullah, 2026-10-25) | PRD F-85, ARCHITECTURE, SECURITY, TESTING |
| DC-047 | 2026-10-25 | Gap-check proposals GP-01 to GP-12 are all approved for v1: billing records with manual Stripe invoices (F-99), onboarding checklist (F-100), admin ops tools (F-101), Terms acceptance (F-102), client documents (F-103), and the operations setup (server and deploy, DNS move to Cloudflare, email domain, monitoring, provider integration details, pre-go-live gates). F-104 to F-106 stay Later. Wording for Terms and Privacy still needs counsel; the Cloudflare DNS move and the ElevenLabs paid plan are actions Abdullah still has to take. | Explicit (Abdullah, 2026-10-25) | PRD, ARCHITECTURE, DATABASE, SECURITY, DESIGN_SYSTEM, TESTING, BUILD_PLAN |
| DC-048 | 2026-10-25 | Metric definitions in the PRD are approved as written (leads received, speed-to-lead median seconds, contact rate, booking rate, revenue recovered = Won deal value with an Alex call or booking). PRD decision 15 is decided. M6-01 and M6-02 are unblocked. Supersedes DC-044 and restores DC-032. | Explicit (Abdullah, 2026-10-25) | PRD, ARCHITECTURE, DATABASE, TESTING, AGENTS, BUILD_PLAN |
| DC-049 | 2026-10-25 | Add-on pricing: CRM Lite is $1,000 setup + $500/mo and CRM Full is $2,000 setup + $750/mo, on top of the main system ($6,500 founding setup covering 3 months, then $1,500/mo). The old $3.5K and $6.5K CRM setup fees and the 25% founding discount on add-on setup fees are dropped. Supersedes the CRM prices in DECISIONS_locked and the discount in DC-020. | Explicit (Abdullah, 2026-10-25) | PRD (module catalog, decision 12, F-86, F-99), DATABASE (`module_prices` seed), TESTING |
| DC-050 | 2026-10-26 | Build-time implementation decision (M0-04, build thread; flagged for Abdullah's review in PR): `app_enable_tenant_rls` creates its four policies `TO kynetic_app, kynetic_worker` instead of `kynetic_app` only, because DATABASE.md says the worker sets tenant context per job and a policy that names only `kynetic_app` would leave the worker with zero rows on every tenant table. Role creation is a superuser bootstrap script (`crm/deploy/db/bootstrap.sql`), not a migration, because roles are cluster-wide and the owner role cannot create `BYPASSRLS` roles. Baseline migration is split across files `0000` to `0003` (one per M0-04 to M0-07) instead of one `0001` file; the 0100+ ranges for later milestones are unchanged. | DATABASE, BUILD_PLAN |
| DC-051 | 2026-10-26 | Build-time implementation decisions (M0-05, build thread; flagged for review): (1) `tenants.email_sender_name text` is added because the DATABASE.md column grant for the runtime role names it but the `tenants` DDL did not define it. (2) The `audit_log` append-only trigger is statement-level, not row-level, so UPDATE and DELETE are refused even from a role whose RLS view is empty (the owner under FORCE RLS), as the test requirements say. (3) The worker also gets INSERT on `audit_log` and SELECT on `tenants`, `users`, `module_catalog`, `module_prices` and own `terms_acceptances`, because jobs write audit rows and read tenant settings (DC-050 reasoning). (4) TypeScript Drizzle schema files are generated from the migrated database once the baseline is complete (M0-07), not per part. | DATABASE, BUILD_PLAN |
| DC-052 | 2026-10-26 | Build-time implementation decision (M0-06, build thread; follows the recommended option already written in DATABASE.md): `btree_gin` is enabled in the baseline so the `contacts` phone and email GIN indexes keep `tenant_id` as their first column. | DATABASE |
| DC-053 | 2026-10-26 | Build-time implementation decision (M0-08, build thread; flagged for review): the `audit_log` insert policy for the runtime roles is `tenant_id IS NULL OR tenant_id = app_tenant_id()` (migration 0004), not `WITH CHECK (true)` as DATABASE.md had it, because the isolation suite showed a session could append audit rows naming another tenant. Sign-in and platform events use a NULL tenant. The platform roll-up functions write their own audit rows as the roll-up role. | DATABASE, SECURITY |
| DC-054 | 2026-10-26 | Build-time implementation decision (M0-09, build thread; flagged for review): the roll-up functions take explicit arguments as listed in DATABASE.md; `admin_tenant_overview` and `audit_search` are callable by admin and VA (the DATABASE.md function table said admin, the SECURITY 2.2 matrix says VA reads the audit log and all-clients view). `create_tenant` also creates the `platform` module row and a paused Alex draft config; the owner invite is an `invitations` row because no user exists yet to hold a membership. | DATABASE, SECURITY |

## Gap check, 2026-10-25 (all approved for v1, DC-047)

Added at Abdullah's request after a sweep of what the portal needs that no doc covered. All twelve were approved for v1 on 2026-10-25 (DC-047); the `UNRESOLVED (proposal)` markers were removed from the docs.

| ID | Date | Proposal | Docs |
| --- | --- | --- | --- |
| GP-01 | 2026-10-25 | F-99: per-tenant billing records for tier pricing (price snapshots per module, discounts, totals feeding MRR). Records only; invoices stay manual in Stripe. | PRD, DATABASE, SECURITY, TESTING, DESIGN_SYSTEM |
| GP-02 | 2026-10-25 | F-100: onboarding checklist per tenant, with an owner-visible setup progress card until go-live. | PRD, DATABASE, TESTING, DESIGN_SYSTEM |
| GP-03 | 2026-10-25 | F-101: admin operations tools (kill switch, webhook replay, job viewer, suspend, 2FA reset, demo reseed). | PRD, SECURITY, TESTING, DESIGN_SYSTEM |
| GP-04 | 2026-10-25 | F-102: Terms and Privacy acceptance at first sign-in; wording needs counsel. | PRD, DATABASE, SECURITY |
| GP-05 | 2026-10-25 | F-103: client documents (agreement, proposal, invoices) uploaded by admin, downloaded by owners. | PRD, DATABASE, SECURITY |
| GP-06 | 2026-10-25 | Server, deploy and preview setup (compose layout, GHCR, deploy script, preview environments behind Cloudflare Access). | ARCHITECTURE |
| GP-07 | 2026-10-25 | Move kyneticai.com DNS to Cloudflare so the portal can sit behind it (needs Abdullah). | ARCHITECTURE |
| GP-08 | 2026-10-25 | Email sending domain `mail.kyneticai.com` with SPF, DKIM, DMARC. | ARCHITECTURE |
| GP-09 | 2026-10-25 | Monitoring and alerting list and thresholds. | ARCHITECTURE |
| GP-10 | 2026-10-25 | Provider integration details for ElevenLabs, Twilio, Resend, n8n; ElevenLabs paid plan and phone import still need Abdullah. | ARCHITECTURE |
| GP-11 | 2026-10-25 | Pre-go-live gates, including KI-006 and KI-008 from the old portal plan. | ARCHITECTURE |
| GP-12 | 2026-10-25 | Later: AI-drafted admin messages and weekly summary (F-104), proposal builder and estimator (F-105), Twenty to portal client sync (F-106). | PRD |

## Still UNRESOLVED (needs outside information)

| Item | Needs |
| --- | --- |
| Delivery date | Abdullah's date |
| Which F-97 direct connectors, in what order, and their API access | Abdullah and the providers |
| State calling and recording rules, consent wording, Terms and Privacy wording, incident notification duties | Counsel |
| Twilio A2P campaign approval and per-tenant sending numbers | Twilio |
| OPM vendors or connectors beyond status records | Abdullah |
