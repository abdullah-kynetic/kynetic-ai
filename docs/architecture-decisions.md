# Architecture decisions (proposed)

All entries are **proposed**. Per CLAUDE.md, real `D-` numbers are assigned by Abdullah; these use the `D-S` placeholder prefix. Each departs from, or fills a gap in, the 2026-11-06 handoff spec.

| ID | Decision | Default taken | Why / departure | Status |
|---|---|---|---|---|
| D-S01 | Test harness location and runner | Reuse Vitest already in `crm/` for TypeScript contract tests; new tests under `templates/systems/<system>/tests/` run by a root-level vitest config added later | Spec proposed Node+TS+Vitest "aligned to repo after inventory"; repo already uses Vitest 5 + bun | proposed |
| D-S02 | System of record vs portal DB | Twenty is the Kynetic operational record for Kynetic-owned automation facts; portal Postgres stays the client-facing store; reconcile via the versioned contract in `docs/portal-n8n-contract.md`; no sync built yet | Repo has two stores; Abdullah (2026-11-06) said to use proposed defaults for open calls | adopted default 2026-11-06, revisit before any sync |
| D-S03 | Dry-run enforcement | Sink adapters at transport layer with recipient allowlist and production-URL denylist | Spec 2.3 | proposed |
| D-S04 | New Twenty objects | None created. Logical entities (Consent Grant, Suppression, Conversation, Outreach Attempt, Appointment, Lease, Usage Ledger, Audit Log, Checkpoint) stay JSON Schema until an approved metadata delta | Spec 8.10 + standing rule; `messageSuppressions` lacks phone | proposed |
| D-S05 | Nurture storage | Evaluate reusing Twenty `messageCampaigns/Lists/Deliveries` for email; separate subscription/content-version schema for SMS/tracks | Native objects exist but are email-oriented | adopted default: reuse Twenty email campaign objects for email nurture; separate schema for SMS/tracks |
| D-S06 | Lease/idempotency store | Decide by test: try n8n data tables + Twenty first; small Postgres table only if atomicity test fails | Spec 6.2, 15 | adopted default 2026-11-06 |
| D-S07 | Consent decision owner | n8n decides; portal logs decision and keeps lists (automation-map, Oct 30). Portal gate remains authoritative until parity suite passes | Matches Abdullah's 2026-10-30 answers | proposed |
| D-S08 | Env var names | New code reads only `TWENTY_BASE_URL`, `TWENTY_SELFHOST_API_KEY` | Standing rule; existing `TWENTY_API_KEY` references flagged, not edited | proposed |
| D-S09 | Maintenance meaning | Customer service/warranty reminders; internal platform maintenance is `platform-maintenance.md` | Spec 1.2 | proposed |
| D-S10 | Build order | Foundation, then text-back, Alex text intake, scheduling, Emily sandbox (spec 12.2) | Spec; not a business-priority claim | proposed |
| D-S11 | Voice recording | Off in sandbox until counsel review (task 1.4) | Spec 2.4, KI-002 | proposed |

## Authorization note (2026-11-06)

Abdullah, in thread: "Go ahead you have my permission to direct the threads write and build in n8n as you see fit". Taken as permission to build **net-new, inactive, DEV-tagged** n8n workflows and the repo code behind them, and to use the proposed defaults for open decisions (D-S02, D-S05, D-S06 now marked adopted). Not taken as permission for: Twenty DELETE, touching Nora / live Emily / live Alex `agent_8201…` / Kynetic Restoration (Demo), real outreach or calls, activation of any workflow, production writes, or committing secrets. Earlier same-day message "I was wrong to say that write and work without my yes" was ambiguous; the later explicit message governs.
