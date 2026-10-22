---
type: object
cluster: retell
universe: live
status: verified
entity: Retell (external); tools/retell.py:129-156
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Retell agent tools (no-touch class)

Alex's tools are created by `build_outbound`: `check_availability_cal`, `book_appointment_cal`, `end_call` (`tools/retell.py:129-156`). KYNETIC_CONTEXT rule 2: never add, remove, rename or change parameters of an agent tool without approval of that exact change.

## Shape
- The Cal key is embedded in the two Cal tools at creation and redacted in snapshots (`REDACT_KEYS`, `:31`).
- `repoint-tools` can change only a custom tool's URL (`:92-97`). Nothing else in the repo edits tools.

## If you change this
- **Hits:** [[alex-agent]], [[retell-client]], the Cal event, the prompt's "Available Tool Calls" section.
- Protection is by instruction only (see [[retell-client]]).
