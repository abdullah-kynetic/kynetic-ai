# CRM docs cross-review (final, 2026-10-25)

> **HISTORICAL — October 25 cross-review.** Active completion checklist: [COMPLETION-PLAN.md](codex/COMPLETION-PLAN.md). Preserve the reviewed specifications and decisions; historical "final", pricing and implementation claims are not a current release certification. Conflicts remain listed in the active plan.


Reviewed the 8 docs against each other, `SPEC_client_crm_portal.md` and `DECISIONS_locked.md` (DECISIONS wins). On 2026-10-25 Abdullah approved every open decision; items he did not rule on explicitly took the recommended option and are marked "Decided 2026-10-25" in the docs. Nothing is deployed or merged.

## Where the docs are
- `AGENTS.md` (repo root) and `docs/` PRD, DESIGN_SYSTEM, ARCHITECTURE, DATABASE, SECURITY, CODE_STYLE, TESTING, plus this file.
- `docs/DECISIONS.md` is the dated decision log (DC-nnn) and `docs/BUILD_PLAN.md` is the step-by-step build plan (127 tasks, waves, model per task, status and resume notes).
- The PRD "Decisions log" holds the 18 numbered decisions the other docs cite ("PRD decision n").

## What is final and consistent
- Feature IDs F-01 to F-106 (PRD canonical) and 9 module keys: platform, alex_core, quote_followup, after_hours, missed_call_textback, reactivation, opm, followup_bundle, crm (lite|full). Every upsell has a per-tenant flag in `tenant_modules`, server gating (module off returns 403 MODULE_DISABLED; another tenant's record returns 404), hidden UI and a test row.
- Roles: Kynetic admin and VA (`users.kynetic_role`), client owner and staff (`memberships.role`).
- Stack: Next.js 16, Postgres 16 with ENABLE + FORCE RLS, Drizzle, pg-boss, Resend, Better-Auth (Google sign-in + email magic links), ElevenLabs primary with Retell fallback, Twilio, n8n. Twenty stays Kynetic-internal; no push to Twenty in v1.
- Milestones: M0 baseline migration (all tables, shared contracts), M1 to M10, M8 split into M8a/M8b, M11 = Online Presence Management. One thread owns one milestone.
- **Alex-only clients get the base portal** (leads, pipeline kanban, appointments, Alex call logs, reports). CRM Lite and CRM Full are paid per-tenant upsells on top; M0 builds the base portal and the module mechanism (PRD decision 1, DC-041).
- Admin 2FA (TOTP) is in v1 (F-98). Clients edit only pause and call hours. Quiet hours 8am to 9pm lead-local with stricter state rules on top; the 60-second promise yields to them.
- Founding price $6,500 setup covering 3 months, then $1,500/mo (the $4,675 figure is dropped). Add-ons: CRM Lite $1,000 setup + $500/mo, CRM Full $2,000 setup + $750/mo, with no founding discount on add-on setup (DC-049). Accessibility WCAG 2.2 AA. Design tokens (success green, input border) approved.
- Import (F-90 to F-97): admin-only wizard, `.csv`/`.xlsx` up to 10 MB / 50,000 rows, dry run before commit, skip duplicates by default with optional fill-blanks, undo lists records edited after import, raw files deleted 30 days after commit, imports never start outreach. Existing portal users: none, clean launch, synthetic demo tenant only.
- Health score (five inputs at 20%, green 70+, yellow 40 to 69, red below 40) is in the PRD. Metric definitions are decided (approved as written, DC-048).
- Commits are authored only as abdullah-kynetic, with no AI co-author trailer and no "Generated with" footer (AGENTS, CODE_STYLE).

## What I changed
Fixed cross-doc contradictions (session variables, table names, module keys, 403 vs 404, error codes, layout, baseline migration model, roll-up role design, RLS FORCE), added the import feature set across PRD, DATABASE, ARCHITECTURE, SECURITY, TESTING, AGENTS, added F-98 and the metric definitions, and converted every proposal into a decision in all eight docs.

## Gap check (2026-10-25) and what was added
Asked: list anything the portal needs that no doc covers. The new items were tracked as GP-01 to GP-12 and all approved for v1 on 2026-10-25 (DC-047).

| Gap | Where it was added |
| --- | --- |
| Hosting and server setup (compose layout, firewall, secrets on the server, image registry, deploy and rollback, preview environments) | ARCHITECTURE Operations, Server and deployment setup |
| Domain, DNS and TLS (kyneticai.com DNS is at Squarespace; portal needs Cloudflare) | ARCHITECTURE Operations, Domain, DNS and email domain. Needs Abdullah. |
| Email sending domain, SPF, DKIM, DMARC, sender names, template list | ARCHITECTURE Operations |
| ElevenLabs, Twilio, Resend, n8n integration details (endpoints, signatures, keys by name, open items) | ARCHITECTURE Operations, Provider integration details |
| Billing and invoicing for tier pricing | PRD F-99, DATABASE `tenant_billing` and `tenant_billing_modules`, SECURITY Appendix D. Records only; invoices stay manual in Stripe. Automation is F-66 (Later). |
| Per-client branding gaps (pre-login pages, emails, no-logo fallback, upload and contrast checks) | DESIGN_SYSTEM gap-check rules, SECURITY Appendix D |
| Backups beyond the nightly dump (R2 versioning and lifecycle, object counts in the restore drill) | ARCHITECTURE Operations |
| Monitoring and alerting (health endpoint, uptime, error tracking, thresholds, alert channel) | ARCHITECTURE Operations, Monitoring and alerting |
| Onboarding flow end to end | PRD F-100 (checklist, owner setup progress), DATABASE `onboarding_steps`, BUILD_PLAN M8a |
| Admin tools (kill switch, webhook replay, job viewer, suspend, 2FA reset, demo reseed) | PRD F-101, SECURITY Appendix D |
| Terms and Privacy acceptance | PRD F-102, DATABASE `terms_acceptances`. Wording needs counsel. |
| Client documents (agreement, proposal, invoices) | PRD F-103, DATABASE `tenant_documents` |
| Pre-go-live gates from the old portal plan (KI-006, KI-008, isolation test) | ARCHITECTURE Operations, Pre-go-live gates |
| Later items from the old portal build-out plan: proposal builder and estimator (F-105), Twenty to portal client sync (F-106), AI drafts and weekly summary (F-104) | PRD |

Re-run against the real `SPEC_client_crm_portal.md` and `DECISIONS_locked.md` (now in `docs/source/`): every spec feature row, table, integration, milestone and open question maps to a doc. The one gap found was that contact merge (spec Contacts, F-07) had no build task; it is now M1-08. Differences from the spec are all recorded decisions: 2FA is v1 not Later (DC-017), import is admin-only in v1 (DC-023), M10's "migrate existing portal users" is replaced by a clean launch (DC-012), M8 is split and M11 added (DC-018), and the in-portal add-on teaser from the spec's business goal is not in v1 (DC-039).

## Notes for the repo
- The root `AGENTS.md` here replaces the existing 5-line pointer to `CLAUDE.md`. The new file opens with a pointer back to `CLAUDE.md`.
- The docs cite `DECISIONS_locked.md` and `SPEC_client_crm_portal.md`; copies are in `docs/source/`.

## Still UNRESOLVED (needs outside information)
1. Delivery date.
2. Which F-97 direct connectors to build (Jobber, ServiceTitan, Housecall Pro, HubSpot, Google Sheets export), in what order, and their API access. Later, not v1.
3. State-by-state calling and recording rules and the consent wording, which need counsel. The app builds to the decided defaults with the state table as versioned config.
4. Twilio A2P campaign approval and per-tenant sending numbers. SMS modules cannot go live until then.
5. OPM vendors or connectors, if Kynetic later wants more than status records in the portal.
