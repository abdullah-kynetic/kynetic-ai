---
type: object
cluster: alex
universe: live
status: verified
entity: retell/builds/outbound-speed-to-lead/PROMPT.md
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Alex prompt (PROMPT.md)

The spoken script for Alex, kept as a draft file whose first line says "prompt v1 draft"; the live version is not recorded in the repo (v1.2.3 is on `claude/alex-demo-live-test`).

## Shape
- Headings: Role (`:10`), Personality, Business Facts (answer only if asked), Primary Objective, Available Tool Calls, Rules, Conversation Flow, six Example Calls, Error Handling (`:130`), then "Agent settings to apply" (`:136`).
- Only the first fenced block that starts `# Role` is sent to Retell (`:9`-`:134`); the settings section after it is notes, not config.

## If you change this
- **Hits:** `tools/retell.py read_prompt`, [[alex-agent]], `FORM_SPEC.md` (dynamic variable names the prompt uses), `PROMPTING_STYLE.md` rules, the demo business facts in `demo-business/`.
- **Does not hit:** the live agent until someone applies it; the n8n workflow (it passes variables, not prompt text).
- Keep AI-disclosure and recording lines (D-011).

## See
- `retell/builds/outbound-speed-to-lead/PROMPT.md`, `retell/PROMPTING_STYLE.md`
