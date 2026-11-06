# Architecture decisions (proposed)

All entries are **proposed**. Per CLAUDE.md, real `D-` numbers are assigned by Abdullah; these use the `D-S` placeholder prefix. Each departs from, or fills a gap in, the 2026-11-06 handoff spec.

| ID | Decision | Default taken | Why / departure | Status |
|---|---|---|---|---|
| D-S01 | Test harness location and runner | Reuse Vitest already in `crm/` for TypeScript contract tests; new tests under `templates/systems/<system>/tests/` run by a root-level vitest config added later | Spec proposed Node+TS+Vitest "aligned to repo after inventory"; repo already uses Vitest 5 + bun | proposed |
| D-S02 | System of record vs portal DB | Treat Twenty as the Kynetic operational record for **Kynetic-owned automation facts**; portal Postgres stays the client-facing store; reconcile via contract | Repo has two stores (portal DB and Twenty); spec says Twenty sole. Needs Abdullah's call before any sync is built | open, needs Abdullah |
| D-S03 | Dry-run enforcement | Sink adapters at transport layer with recipient allowlist and production-URL denylist | Spec 2.3 | proposed |
| D-S04 | New Twenty objects | None created. Logical entities (Consent Grant, Suppression, Conversation, Outreach Attempt, Appointment, Lease, Usage Ledger, Audit Log, Checkpoint) stay JSON Schema until an approved metadata delta | Spec 8.10 + standing rule; `messageSuppressions` lacks phone | proposed |
| D-S05 | Nurture storage | Evaluate reusing Twenty `messageCampaigns/Lists/Deliveries` for email; separate subscription/content-version schema for SMS/tracks | Native objects exist but are email-oriented | open |
| D-S06 | Lease/idempotency store | Decide by test: try n8n data tables + Twenty first; small Postgres table only if atomicity test fails | Spec 6.2, 15 | open |
| D-S07 | Consent decision owner | n8n decides; portal logs decision and keeps lists (automation-map, Oct 30). Portal gate remains authoritative until parity suite passes | Matches Abdullah's 2026-10-30 answers | proposed |
| D-S08 | Env var names | New code reads only `TWENTY_BASE_URL`, `TWENTY_SELFHOST_API_KEY` | Standing rule; existing `TWENTY_API_KEY` references flagged, not edited | proposed |
| D-S09 | Maintenance meaning | Customer service/warranty reminders; internal platform maintenance is `platform-maintenance.md` | Spec 1.2 | proposed |
| D-S10 | Build order | Foundation, then text-back, Alex text intake, scheduling, Emily sandbox (spec 12.2) | Spec; not a business-priority claim | proposed |
| D-S11 | Voice recording | Off in sandbox until counsel review (task 1.4) | Spec 2.4, KI-002 | proposed |
