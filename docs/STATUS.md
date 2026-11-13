# STATUS: start here for project status (2026-11-08 PST)

A pointer, not a second scoreboard. Twenty is the business source of truth. GitHub is the technical execution record (code, pull requests, CI, and deploy evidence). On a mismatch, flag both values. This GitHub docs pass did not read or write Twenty. The parallel Twenty cleanup is recorded below from the parent's verification.

## Source-of-truth change (2026-11-12)

Abdullah decided the portal is the one place lead, client and call data is written. Twenty held 4 companies, 2 people, 0 opportunities and 0 call logs, so there was no customer data to migrate (the Demo records are no-touch and stay in Twenty). Its 120 notes and 63 tasks were copied to `docs/roadmap/` as read-only history. Twenty stays up read-only as a safety copy; do not write lead data to it and do not build the portal-to-Twenty push (KI-024 closed as won't-build). The roadmap, baseline and scorecard note ids named below still identify the archived copies. Still open: the website contact form workflow writes a person into Twenty and must be pointed at the portal (needs Abdullah's yes), and five Twenty attachments (`wave2/3/4-raw.csv`, `search-queries.csv`, `kynetic-remaining-work-2026-11-06.md`) are not yet copied.

## Portal batch 3 (2026-11-10)

The admin side can pause every call and text from Operations. That pause only adds a block. `OUTBOUND_ENABLED=false` still stops everything, and nothing in this batch can turn that switch on. Usage for each client is on `/admin/usage` for Kynetic staff: minutes, calls, texts, emails, provider cost, the fee already stored, and whether a spend cap is close or reached. Clients do not see cost. An admin can offboard a client by typing the slug. That suspends the client, stops automations, revokes service tokens, and queues a zip of their records. The 30-day date on screen is a reminder only. Nobody is deleted automatically. Failed jobs and a morning admin digest show up in the portal. Weekly client email and the monthly report link exist and stay off unless both the server flag and the per-client toggle are on. No live call, text, or email was sent.

## Portal line (2026-11-09 PST)

Abdullah stopped the second portal line. The portal implementation that lived on `dev/codex-setup` is the code for `main`. `main` is the only build that may be deployed to production at portal.kyneticai.com, and only after an explicit yes. A separate DEV environment is retired until after go-live: do not deploy `dev.kyneticai.com`, and do not keep working on `dev/codex-setup`. New work branches off `main`. This note does not deploy. Live production is `main` `416b165617577e0468de03fabcfb383d220b584d` (PR #149) as of 2026-11-09 evening PST, after PRs #146, #147, and #150; further deploys still need an explicit yes unless Abdullah has already authorized the operator to ship ready batches.

`docs/codex/CURRENT_STATUS.md` restates this portal fact. `docs/codex/COMPLETION-PLAN.md` stays historical evidence. Merging the portal code does not make that file the plan. The five steps below remain the operating order.

## Portal engineering note (2026-11-10)

Production at portal.kyneticai.com is `main` `416b165617577e0468de03fabcfb383d220b584d` (PR #149), with migration `1018_admin_ops_safety`. Earlier live tips were `df8b61a6` (PR #150, migration `1017_agency_sales_tools`), `b27b9d2a` (PR #147, migration `1016_systems_templates_guarantee`), and `ac0192af` (PR #146, migration `1015_schedules_retention_settings`). `PROVIDER_MODE=stub` and `OUTBOUND_ENABLED=false` are unchanged. The 2026-11-09 note that still said release `350bf673` is stale for that revision; this file is the current pointer.

PR #146 is live: daily metrics and monthly report fanout, admin service tokens, encrypted n8n push settings, agency billing drafts outside stub mode, contact-merge consent fixes, CSV-only import, and the retention purge.

PR #147 is live: the per-client systems library, template apply, remodeling industry, client My systems requests, and the 30-day 20% booking guarantee tracker (admin baseline override).

PR #149 is live: admin outbound pause, `/admin/usage`, offboarding without automatic deletion, failed-job alerts and the daily admin digest (email off by default), and weekly/monthly client emails that stay off unless both flags are on.

## Agency sales tools (2026-11-10)

PR #150 is live at portal.kyneticai.com as `main` `df8b61a651622c5bf0b3d1c1f8a86cb095c66b52`, with migration `1017_agency_sales_tools`.

The agency workspace can schedule a Pacific-time callback, mark a campaign step done, skip it, or reschedule it, and export a proposal PDF. Contracts, expenses, referrals, and case studies are tracked by hand. None of those actions place a call, send a text or email, or charge a card. "Simulate Stripe event" and "Simulate step" stay available outside production and are refused when `NODE_ENV` is production. Excel `.xlsx` import is available (KI-018). Retell cannot be saved as an Alex provider. Prices are still not in the proposal PDF (KI-021). Stored files for a deleted or replaced document are kept (KI-020).

## Client workspace (batch 2, 2026-11-10)

The client dashboard can show 7, 30, or 90 days, or a custom range, in the client's time zone. Speed-to-lead and booking rate use the same formulas as the monthly report. The 30-day booking guarantee is unchanged. Appointments have month, week, and day views and a contact search instead of a raw id. Automations show recent run results and stay read-only. Pipeline owner and source filters were already on `main`; this batch adds browser coverage. Support is a thread on both the client side and the Kynetic side, with an in-app alert and no email. Alex settings can file a change request. The terms acceptance page exists and stays off unless `TERMS_GATE_ENABLED=true`. Migration `1019_support_threads_category` follows `1018_admin_ops_safety`. This note does not deploy. `PROVIDER_MODE=stub` and `OUTBOUND_ENABLED=false` are unchanged. Left open: terms wording (KI-026), calendar sync (KI-027), automation editing (KI-028), and support email (KI-029).


## Current direction

Abdullah's five steps are the operating order. There is one roadmap: Twenty note `7bfdcb7e`. Frozen checks and weights stay in note `603fe300` (baseline v1). Current scores stay in note `5c44b12e`. The Twenty twin of this file is note `2489986e`. Those ids were already on main. This pass did not re-read the notes.

1. Consolidate the plan. GitHub instructions point here. The broader systems roadmap stays later. It is kept, and it is not a build-everything-first gate.
2. Sales-ready foundation, in parallel with step 3: verify portal access protection, keep the approved outcomes-focused site and offer, and finish the audit, pitch, and close scripts.
3. Productize the delivery package, in parallel with step 2: Alex on ElevenLabs through n8n on the VPS, one configurable CRM, scheduling, essential follow-up, and demo end-to-end templates.
4. Cold-call remodelers until the first three clients are signed. Other channels wait until then.
5. Deliver, measure appointments and effort, improve the templates, write case studies, then expand channels and multi-location.

Kynetic is positioned as an AI growth partner. The standard portal in `crm/` and a bespoke client portal are separate engagements.

Offer in force, locked 2026-11-05: "We book remodelers 20% more appointments than last month in 30 days, or we work free until we do." The baseline is last month's booked appointments. The client keeps ads running and takes the appointments. Booking the jobs is the client's job. The older 14-day wording and the monthly-fee waiver are not the active guarantee.

## Pricing precedence

Twenty D-023, approved 2026-10-24, is the historical pricing authority and supersedes repo D-017. This pass did not copy its dollar amounts. The 2026-11-08 read-only review records the decision note as `93db3245-96ee-4fb8-8afd-73ae66985d95`. That id was not re-fetched here. A 2026-11-06 chat proposed further founding, regular, and custom transformation numbers. Those proposals are not approved. Do not quote D-017 ($4,675 / $8,500) or the 2026-10-25 portal menu ($6,500 and the CRM Lite/Full add-on fees) as the current price. The Nov 5 guarantee supersedes older guarantee wording. It leaves the underlying price schedule on D-023. Commercial scope is still uncertain: the approved D-023 figures are not restated in this repo, and the later proposal is not approved. This file does not ask anyone to choose again between D-017 and D-023.

The CRM is one configurable deliverable. Lite and Full are not current commercial tiers. Where the portal code and the technical docs still say `lite` or `full`, that is an internal capability flag from 2026-10-25. This pass does not change code or schema.

## Scorecard (unchanged)

Snapshot of the 2026-11-08 scorecard, steps 1-3 readiness: 23% verified complete, 53% verified incomplete, 24% unverified. Business outcomes stay separate: signed clients 0 of 3, opportunities 0, call logs 0. Frozen weights in `603fe300` are unchanged. Step 1's recorded 100 belongs to that narrow baseline. It is not a claim that every conflicting instruction was already clean, and this docs pass does not raise any percentage. A broader Twenty rescore, if one is wanted later, is a new baseline beside v1.

## Release risks (not re-tested here)

These stay as recorded in `docs/audit/2026-11-08-code-evidence.md`. This pass ran no production probe, deploy, or workflow check.

- Portal access protection is not production-verified. The ledger's HTTP 200 on `/admin` is labeled inference and does not prove an exposed admin page. Main has merged sign-in work that CI recorded as tested. Whether that revision is what the live portal runs was not established here.
- There is no current attributable proof of an active Alex lead-to-booking path.
- Counsel sign-off on calling, recording, and consent wording remains open (`docs/known-issues.md` KI-002).
- DNC scrub, stored consent, and quiet hours are required operating controls. Twilio A2P approval is not permission for cold SMS.
- The public site and the live offer still need to be checked against the Nov 5 guarantee. This pass did not fetch the site.
- Contact-merge consent behavior on main still diverges from the decision held on open PR #113 (known-issues audit note).

## What this repo is for

Technical evidence: `docs/audit/2026-11-08-code-evidence.md`. Dated log: `docs/progress.md`. Business history plus the 2026-11-08 PST precedence note: `docs/decisions.md`. Gotchas: `docs/known-issues.md`. Rules and ids: `KYNETIC_CONTEXT.md`. `docs/BUILD_PLAN.md` is the portal technical task list. Its Status column is a claim, not acceptance, and not the business scorecard.

## Twenty cleanup (parent-reported, 2026-11-08 PST)

A parallel Twenty cleanup finished on 2026-11-08 PST. The parent verified the worker result. This GitHub pass did not read Twenty. The figures below are that verification, not an independent live read.

- 11 notes and 23 tasks were updated. The readback covered all 34 of those updates.
- All 63 tasks are mapped. The missing Step 2 tag was fixed.
- Current direction, voice provider, one CRM, and the Nov 5 guarantee were reconciled. History was preserved.
- Baseline note `603fe300` is unchanged.
- Counts after that cleanup: 88 notes and 63 tasks (52 TODO, 4 IN_PROGRESS, 7 DONE).
- Left untouched: stale `dueAt` values, schema, customer records, and live systems.
- Claude-only scorecard files were outside that readback.

## Branch artifact (not authority)

`docs/codex/COMPLETION-PLAN.md` is historical evidence from the old portal branch (snapshot `81496f99b2dd20a88e6cbc080b33e0a73e76a2aa`, 2026-11-06). It is not the roadmap. The 2026-11-09 PST decision puts the portal code on `main` and retires the separate DEV environment until after go-live. Do not execute that file as the plan, and do not open new work on `dev/codex-setup`. `docs/codex/PROGRESS.md` is a technical log, not a checklist to execute.

## Docs reconciliation (2026-11-08 PST)

| Surface | Change on this branch | Still limited |
|---|---|---|
| Entry instructions (`CLAUDE.md`, `AGENTS.md`, `KYNETIC_CONTEXT.md`, `docs/CONTEXT.md`, `docs/codex/PROMPT.md`, folder `CONTEXT.md` files on the Alex path) | Point here. Retell-as-current, the five-client gate, build-everything-first, the AI commit trailer, the dead `TWENTY_API_KEY` name, and the "lowest unchecked Codex step" default are marked historical. | Check 3.4 uses `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY` (brought in with main, PR #141). |
| `docs/decisions.md`, `docs/progress.md` | Old gates marked superseded. Headings below the historical marker are history. | Twenty wording for direction, provider, one CRM, and the guarantee was reconciled in the parent-verified cleanup above. This GitHub pass did not read Twenty. Still untouched there: stale due dates, schema, customer records, live systems, and Claude-only files outside that readback. |
| Portal technical docs (`docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/BUILD_PLAN.md`, `docs/REVIEW-SUMMARY.md`, plus `docs/TESTING.md`, `docs/DATABASE.md`, `docs/DESIGN_SYSTEM.md`) | Banner: technical scope. Lite/Full and the Oct 25 prices are historical commercial terms. Internal `lite`/`full` flags stay documented because the code still has them. | No code or schema change. Module levels still exist in the app. |
| `docs/plans/ALEX-ELEVENLABS-N8N-SPEC.md`, `docs/lead-engine-handoff.md`, `docs/plan1-walkthrough.md` | Classified historical. Existing superseded banners on other plan files were left in place. | The bodies still contain old prices and old steps under the banner. |
| Scorecard | Weights and 23/53/24 left as recorded. | Not a rescore. Step 1's narrow 100 is not extended to this cleanup. |
| `docs/codex/COMPLETION-PLAN.md` | Marked historical. The 2026-11-09 decision keeps it as evidence and puts the portal code on `main`. | The old checklist body is still in the file under that banner. |

## Update from evidence

1. Get a link with an observation date (PR, CI run, deploy record, curl result, Twenty record id).
2. Set the matching check in Twenty note `5c44b12e` to verified complete, verified incomplete, or unknown with that link. Never change weights in `603fe300`.
3. A task goes DONE only when its check is verified complete. GitHub items close on the same evidence.
4. Recompute percentages. Unknown stays in the denominator.
5. Mirror the headline numbers here in a branch and PR (merge commit), and log the change with reversal steps.
6. A scope change is a new baseline v2 beside v1, so growth cannot inflate progress.
