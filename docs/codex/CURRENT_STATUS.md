# Current portal status

Updated **2026-11-09 PST**. Canonical status is [../STATUS.md](../STATUS.md). This file restates the same portal facts.

- One portal line. The portal implementation that was on `dev/codex-setup` is the code for `main`.
- `main` is the only build that may be deployed to production at portal.kyneticai.com, and only after an explicit yes.
- The separate DEV environment (`dev.kyneticai.com`, `scripts/deploy-dev.sh`, `crm/deploy/dev/`) is retired until after go-live. Do not deploy it. Do not continue `dev/codex-setup`.
- [COMPLETION-PLAN.md](COMPLETION-PLAN.md) is historical evidence, not the operating plan. The operating order is the five steps in `docs/STATUS.md`.
- This note does not deploy. Live production remains release `350bf673` until that yes.
- [PROGRESS.md](PROGRESS.md) is a technical log, not a second roadmap.

## Historical snapshot (2026-11-06)

The sections below are the 2026-11-06 DEV snapshot. They are not the current operating status. They do not update or supersede the Twenty business roadmap.

## Code versus deployment

| Item | Last verified state |
| --- | --- |
| Completed implementation/audit reference | `1eb4b8e223a81d88d0a44e727fb04f73fdcbf910`; includes agency steps 7–12, Motion/Impeccable UI refinement and Unslop polish. Later status-only commits do not change app behavior. |
| Branch | dev/codex-setup; changes committed and pushed as abdullah-kynetic, no AI/coauthor trailers. |
| Confirmed DEV deployment | `c34b11aa359c933410bfec5522d9ced32cdc3e7e`, reported by Abdullah's Mac; https://dev.kyneticai.com. |
| Changes awaiting DEV deployment | Motion/Impeccable and Unslop UI refinements after c34b11a. No later deployment output received. |
| Production | No production deployment or main/.github change in this work. |

## Built and locally verified

- Agency leads/source fields, lead list, transactional in-app alerts and metrics/report scheduling.
- Unified SMS/email inbox with manual inbound/outbound DM tracking and agreed seven-day pick/reply rates.
- SMS/email drafts, consent/quiet-hours/kill-switch gate previews and idempotent stub delivery. No real delivery adapter path enabled in the agency UI.
- Manual call logging and editable campaign task sequences; no AI dialer or automatic sends. Task stop conditions and stub statistics tested.
- Client operations overview, onboarding links, inert DEV integration drafts, masked agency secret rotation and daily in-app digest scheduling at 08:00 America/Los_Angeles.
- Per-deal USD setup/optional monthly/installment pricing drafts, invoice stub ledger/event processing and overdue reminder drafts. No live Stripe path or signed public Stripe webhook endpoint enabled.
- Shared agency navigation, responsive forms, pending feedback, readable statuses/dates, neutral source counts, light/dark support and reduced-motion behavior.

## Latest validation

| Check | Result |
| --- | --- |
| Unit suite | **527 PASS** |
| Chromium agency journeys | **3 PASS**: roadmap, workspace and manual dialer/campaigns |
| UI coverage | Five mobile light-theme axe scans and one dark/reduced-motion scan: zero violations; 390px overflow, keyboard and authenticated no-JavaScript checks pass |
| Agency step checks 7–12 | **13 PASS / 0 FAIL / 2 manual SKIP** |
| Build, typecheck, lint | PASS; existing lint warnings remain |

These are local synthetic/stub results, not deployed verification. Earlier 523-unit results in the historical logs predate the four Unslop date/label tests.

## What the Mac deployment output proves

Recorded in [vps-evidence.json](vps-evidence.json), `agency_dev_deployment`: DEV root/app health 200, sign-in 200, anonymous admin 401, unsigned intake 401, isolated synthetic database, consent block, quiet-hours defer, global/tenant kill blocks, rollback fixtures and zero provider requests. Providers reported stubbed/outbound disabled; production reported unchanged.

It does **not** verify authenticated agency screens, actual scheduled execution, worker readiness, TEST_PHONE configuration, real booking, messaging or Stripe. The earlier worker/TEST_PHONE blockers are historical observations; no newer readiness result clears them. [dev-live-test-readiness.json](dev-live-test-readiness.json) and [dev-resources.json](dev-resources.json) retain their original observed facts/resource IDs rather than fabricated refreshes.

Full detailed build/integration/verification backlog: [REMAINING-WORK.md](REMAINING-WORK.md). A matching Markdown attachment and readable note were created in Twenty at Abdullah’s request; see [upload evidence](remaining-work-twenty-evidence.json). This documentation does not clear any outstanding checks.

## Remaining work and approval gates

1. Separate Mac DEV deployment for the new UI; then verify authenticated screens and actual agency worker/schedule execution on DEV.
2. Resolve/recheck TEST_PHONE and restricted-worker readiness; finish/verify real booking/provider configuration before a live chain test.
3. Real TEST_PHONE send (step 9.2) and step-6 end-to-end live test require Abdullah's explicit yes. Step 6 and overall step 9 remain incomplete.
4. Real email sender/approved recipient and actual Stripe integration remain separate work; no charges or real delivery without explicit approval.
5. Keep all DEV n8n workflows inactive, preserve Twenty exact-write approval and protected-record rules, never touch live Alex or AM-1 Roofing.

No live test or production release approval is inferred from completed local checks. Steps 0–6 and their original text/checklists are unchanged; their dated acceptance scope is in PROGRESS.md. Agency checklist ticks mean the documented local/stub checks passed, not universal live readiness.

## Review and tools

- [Agency screen/test guide](AGENCY-REVIEW.md)
- [UI design/Motion review](../ui/AGENCY-DESIGN.md)
- [Attributed Unslop audit and previews](../ui/UNSLOP-REVIEW.md)
- [Testing history and commands](../TESTING.md)
- Local checks: `bash scripts/checks/agency-local.sh` with Bun, psql and disposable loopback PostgreSQL configured; no remote database accepted. Browser opt-in is documented in the guide.

Unslop: Damir Sokolovsky / [@heydamir](https://x.com/heydamir), [heydamir/unslop](https://github.com/heydamir/unslop), CC BY 4.0. Impeccable guidance and installed Motion/Tabler/Base UI were also used. Prompt Motion could not be inspected: proxy CONNECT returned 403 and the running session reported an enforced restricted policy without that host, despite intended all-domain access.
