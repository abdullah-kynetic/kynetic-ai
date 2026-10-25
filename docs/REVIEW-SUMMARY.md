# CRM docs cross-review (final, 2026-10-25)

Reviewed the 8 docs against each other, `SPEC_client_crm_portal.md` and `DECISIONS_locked.md` (DECISIONS wins). On 2026-10-25 Abdullah approved every open decision; items he did not rule on explicitly took the recommended option and are marked "Decided 2026-10-25" in the docs. Nothing is deployed or merged.

## Where the docs are
- `AGENTS.md` (repo root) and `docs/` PRD, DESIGN_SYSTEM, ARCHITECTURE, DATABASE, SECURITY, CODE_STYLE, TESTING, plus this file.
- The PRD "Decisions log" holds the 18 numbered decisions the other docs cite ("PRD decision n").

## What is final and consistent
- Feature IDs F-01 to F-98 (PRD canonical) and 9 module keys: platform, alex_core, quote_followup, after_hours, missed_call_textback, reactivation, opm, followup_bundle, crm (lite|full). Every upsell has a per-tenant flag in `tenant_modules`, server gating (module off returns 403 MODULE_DISABLED; another tenant's record returns 404), hidden UI and a test row.
- Roles: Kynetic admin and VA (`users.kynetic_role`), client owner and staff (`memberships.role`).
- Stack: Next.js 16, Postgres 16 with ENABLE + FORCE RLS, Drizzle, pg-boss, Resend, Better-Auth (Google sign-in + email magic links), ElevenLabs primary with Retell fallback, Twilio, n8n. Twenty stays Kynetic-internal; no push to Twenty in v1.
- Milestones: M0 baseline migration (all tables, shared contracts), M1 to M10, M8 split into M8a/M8b, M11 = Online Presence Management. One thread owns one milestone.
- Admin 2FA (TOTP) is in v1 (F-98). Clients edit only pause and call hours. Quiet hours 8am to 9pm lead-local with stricter state rules on top; the 60-second promise yields to them.
- Founding price $6,500 setup + 3 months, then $1,500/mo (the $4,675 figure is dropped). Accessibility WCAG 2.2 AA. Design tokens (success green, input border) approved.
- Import (F-90 to F-97): admin-only wizard, `.csv`/`.xlsx` up to 10 MB / 50,000 rows, dry run before commit, skip duplicates by default with optional fill-blanks, undo lists records edited after import, raw files deleted 30 days after commit, imports never start outreach. Existing portal users: none, clean launch, synthetic demo tenant only.
- Metric definitions and health score (five inputs at 20%, green 70+, yellow 40 to 69, red below 40) are in the PRD.
- Commits are authored only as abdullah-kynetic, with no AI co-author trailer and no "Generated with" footer (AGENTS, CODE_STYLE).

## What I changed
Fixed cross-doc contradictions (session variables, table names, module keys, 403 vs 404, error codes, layout, baseline migration model, roll-up role design, RLS FORCE), added the import feature set across PRD, DATABASE, ARCHITECTURE, SECURITY, TESTING, AGENTS, added F-98 and the metric definitions, and converted every proposal into a decision in all eight docs.

## Notes for the repo
- The root `AGENTS.md` here replaces the existing 5-line pointer to `CLAUDE.md`. The new file opens with a pointer back to `CLAUDE.md`.
- The docs cite `DECISIONS_locked.md` and `SPEC_client_crm_portal.md`, which are not in this repo.

## Still UNRESOLVED (needs outside information)
1. Delivery date.
2. Which F-97 direct connectors to build (Jobber, ServiceTitan, Housecall Pro, HubSpot, Google Sheets export), in what order, and their API access. Later, not v1.
3. State-by-state calling and recording rules and the consent wording, which need counsel. The app builds to the decided defaults with the state table as versioned config.
4. Twilio A2P campaign approval and per-tenant sending numbers. SMS modules cannot go live until then.
5. OPM vendors or connectors, if Kynetic later wants more than status records in the portal.
