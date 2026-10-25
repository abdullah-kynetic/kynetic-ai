---
type: object
cluster: lead
universe: live
status: verified
entity: docs/decisions.md
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Pricing (D-017)

> **Superseded by D-024 (2026-10-24).** Current: founding $6,500 for the first 3 clients ($1,500/mo after month 3), standard $10,000 after ($2,000/mo after month 3). See `docs/decisions.md` D-024. Kept for history.

$4,675 for clients 1-3, $8,500 for client 4 and up, three Stripe invoices (50% at start, 25% when built and sent for testing, 25% at completion), not a subscription. Signed off by Quentin 2026-10-13. D-001 is superseded (`docs/decisions.md:5-11`).

## If you change this
- **Hits:** `KYNETIC_CONTEXT.md`, `docs/decisions.md`, `docs/plan1-walkthrough.md`, Twenty tasks 4.3, 4.5, 4.6, the "Plan 1: $30K by Dec 31" dashboard; Stripe and proposal drafts outside the repo.
- Add a new D-number rather than editing D-017.
