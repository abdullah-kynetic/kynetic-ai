# Systems build: master index (refined)

One-page summary: [OVERVIEW.md](OVERVIEW.md). Refines `source-handoff-2026-11-06.md` (the original handoff, kept verbatim). Phase 1 only: inventory and specification, read-only. Evidence: `docs/build-inventory.md`. Decisions/departures: `docs/architecture-decisions.md`.

Treat every design statement as a proposal until verified. Vendor APIs, webhook behavior, n8n node behavior and consent rules are **not yet verified** against current documentation (no vendor docs were fetched in Phase 1; this is the first item of Phase 2).

## Refinements to the master spec

1. Every system doc opens with evidence status (EXISTING/PARTIAL/MISSING/UNKNOWN/CONFLICT) and has a requirement-to-workflow-to-field-to-test matrix. 88 requirements across 16 docs.
2. Existing assets change the build order: portal-side consent, quiet-hours, outbound gate, sequences, appointments and missed-call code already exist in `crm/src/server/*`; the work is moving the decision into n8n with parity tests, not greenfield.
3. Twenty already has campaign and suppression objects; email-only suppression needs a phone-capable successor (D-S04).
4. The spec's `TEMPLATE-00..07` items map to Phase 1/2 deliverables below.

## Documents

| Doc | Family | Evidence summary |
|---|---|---|
| [alex](alex.md) | Revenue Response | partial: legacy n8n + portal gate; ElevenLabs dev workflow inactive |
| [emily](emily.md) | Revenue Response | legacy only; live agent not inspected |
| [textback](textback.md) | Revenue Response | portal code + inactive VPS DEV workflow |
| [quote](quote.md) | Pipeline Conversion | mostly missing |
| [reactivation](reactivation.md) | Pipeline Conversion | legacy Notion workflows, portal code |
| [nurture](nurture.md) | Pipeline Conversion | Twenty campaign objects, no tracks |
| [review](review.md) | Customer Growth | legacy chain, missing request job |
| [referral](referral.md) | Customer Growth | missing |
| [maintenance](maintenance.md) | Customer Growth | missing; scope ambiguous |
| [crm](crm.md) | Revenue Infrastructure | Twenty 47 objects mapped; env-var conflict |
| [scheduling](scheduling.md) | Revenue Infrastructure | Cal.com + portal availability; no locks |
| [presence](presence.md) | Acquisition & Visibility | task-list model only |
| [ads](ads.md) | Acquisition & Visibility | missing |
| [platform-maintenance](platform-maintenance.md) | Platform | backups, CI, DEV alert workflows |
| [portal](portal.md) | Platform | contract exists, many routes target-only |
| [custom](custom.md) | Platform | scoping category |

## Phase plan (mapped to spec 12.2)

- Phase 1 (this branch, docs): inventory, per-system specs, decisions. **Done in draft.**
- Phase 2: verify vendor docs; JSON Schemas (`TEMPLATE-01`), sink adapters + fixtures (`TEMPLATE-02`), mocked tests, all local. No live writes.
- Phase 3+: inactive n8n workflows and sandbox agents only with explicit scoped approval.

## Cross-system test IDs

End-to-end scenarios 1-12 from spec 14.2 map to tests `T-X-01..T-X-12`, to be authored with the shared lease/policy suite (not yet written).
