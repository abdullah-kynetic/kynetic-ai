---
type: process
status: stale
consumes: [alex-prompt, alex-agent]
produces: [alex-agent]
verified_on: 2026-10-22
verified_at: 5888b13
---

# change-alex

> Stale as of 2026-11-08 PST. This process is the parked Retell path. Do not run it against live ElevenLabs Alex `agent_8201m5afn2rbeb7v29xfkhh1pjef`. Current direction: `docs/STATUS.md`.

Historical movement: edit the Retell spec, show a dry run, get a yes, then create or update in Retell.

## Input -> Movement -> Output
Input: edited `PROMPT.md` / `agent.config.json`. Movement: `python tools/retell.py create-outbound` prints the LLM and agent payloads (Cal key redacted) and sends nothing. Output: a NEW unpublished agent and LLM only after `--apply`; an existing Alex is never edited by this path.

## Why this shape
Creating beats editing: the script refuses a name that already exists (`tools/retell.py:178-179`), so a typo cannot overwrite production.

## Steps
1. Edit the spec files (the prompt must keep one `# Role` fenced block: `retell.py:114-121`).
2. Dry run `create-outbound` (needs `CAL_API_KEY` in the environment: `:125`).
3. Show Abdullah the payload; wait for a yes on that exact change.
4. Apply; then update the agent id in both Set nodes of [[outbound-speed-to-lead-workflow]] and the webhook URL on the agent.

## If you change this
- **Hits:** [[alex-agent]], [[alex-prompt]], [[retell-client]], progress.md version note.
- **Does not hit:** Nora, Emily.
