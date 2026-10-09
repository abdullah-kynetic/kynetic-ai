# Decisions: Outbound Speed to Lead demo

Build-specific. Global decisions live in `docs/decisions.md` (D-001 to D-016); Twenty wins.

## Applies to this build
- D-011 AI disclosure and recording line in the opening. D-012 hang up on voicemail, retries, gpt-4.1. D-013 Plan 1 only. D-014 architecture. D-015 roofing, Kynetic Roofing, agent Alex. D-016 AM-1 profile copied, only the name changes.

## Build-level notes (not global decisions)
- 2026-10-09: Vapi is a side experiment, not a pivot. Retell stays the main build until a side-by-side test says otherwise. A platform change needs a new global decision recorded in Twenty and `docs/decisions.md` first.
- 2026-10-09: Voice is a placeholder (ElevenLabs "sarah"). Revisit after testing. Demo, so voice is low priority.
- 2026-10-09: KB is plain `.txt` in Vapi because `.md` fails processing there.
- 2026-10-09: Vapi step rule: Abdullah approves every write, one step at a time; Claude re-reads and reports what changed after each.
