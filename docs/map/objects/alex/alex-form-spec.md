---
type: object
cluster: alex
universe: live
status: verified
entity: retell/builds/outbound-speed-to-lead/FORM_SPEC.md
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Lead form spec

One table maps each form field to a Twenty `endCustomer` field and a Retell dynamic variable. The n8n Form Trigger stands in for the Meta Instant Form (D-014); consent wording is a draft until counsel signs off (task 1.4).

## If you change this
- **Hits:** the form node and `Normalize Lead` code in [[outbound-speed-to-lead-workflow]] (field labels and dropdown options are matched by exact text there), the Twenty field names, the variables the Alex prompt reads.
- **Does not hit:** `agent.config.json`.
- Changing consent wording is a legal item: needs counsel (KI-002, task 1.4).

## See
- `retell/builds/outbound-speed-to-lead/FORM_SPEC.md`
