## Lane A parked decisions — 2026-11-11

- P-A1: dedicated Plan 2 module keys. Use the existing keys and levels in the queue's gate matrix; need an approved module catalog before adding keys.
- P-A2: clients see cost? Usage will show quantities and cap status only, with no dollar amounts; need an explicit product decision before changing visibility.
- P-A3: n8n vs worker and live messaging/A2P. Build queued/manual UI without new delivery jobs or adapters; need separate approved orchestration and live-provider rollout.
- P-A4: invoices/Stripe. Quote UI will mark invoices coming soon; need an approved billing integration scope.

## Lane B

- **P-1 — Demo prices:** Agency proposals, contracts, and invoice drafts need commercial prices, but current pricing remains open. Seeded prices are labelled "to be confirmed" and no charge path is enabled. Needed: Abdullah approves the current price schedule.
- **P-2 — Recording disclosure wording:** Demo calls have no recording object and use a clearly synthetic transcript. The tenant disclosure field remains unchanged. Needed: counsel-approved wording.
- **P-3 — Cross-lane demo tables:** Lane A owns review requests, client referrals, conversation state, quotes, nurture enrollments, and ad spend. B-last fills them after those migrations land on `main`. Needed: Lane A migrations merged.
