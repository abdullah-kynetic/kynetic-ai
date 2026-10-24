---
type: object
cluster: retell
universe: live
status: verified
entity: tools/retell.py
verified_on: 2026-10-22
verified_at: cbb5046 (source files unchanged since 67763e6)
---

# tools/retell.py

Stdlib Python client for the Retell API. Writes are dry runs unless `--apply` (`tools/retell.py:71-75`, `:189`).

## Shape
- Reads: `get-agent`, `get-llm`, `snapshot` (writes local files, redacts `cal_api_key`).
- Writes to ANY agent/LLM id you pass: `rename-agent`, `set-begin-message`, `set-agent-webhook` (`:206-211`). There is no allow/deny list of ids in the code.
- `repoint-tools`: changes only a custom tool's `url`, and exits if anything else would change (`:92-97`). Still works on any llm id.
- `create-outbound`: creates a new LLM + agent only; refuses if the name exists (`:178-179`). Needs `CAL_API_KEY` from env.
- Key loading: `RETELL_API_KEY` from env or `.env` (`:34-42`); `CAL_API_KEY` from env only (`:125`).

## If you change this
- **Hits:** `.claude/settings.json` allowlist (used to pre-approve `python tools/retell.py *` (narrowed 2026-10-22 to the three read commands), so `--apply` now prompts), `retell-builder` skill, `KYNETIC_CONTEXT.md` Access, [[alex-agent]] (reads `PROMPT.md`, `agent.config.json`).
- **Does not hit:** n8n, Twenty.
- **Protection is instruction-only:** nothing in code stops a write against Nora or Emily ids.

## See
- `tools/retell.py`, `.claude/settings.json`
