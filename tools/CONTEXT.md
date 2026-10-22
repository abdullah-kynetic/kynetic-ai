# tools: scripts that talk to live systems

One job: small stdlib-Python clients. Check here before writing a new script.

## Files
- `retell.py`: Retell API client. Every write is a dry run unless `--apply`.
- `n8n_backup.py`: exports n8n workflows into `n8n/workflows/`. GET only (but deletes repo files missing from the n8n it queries).
- `map_check.py`: read-only drift check for `docs/map` and the context docs. No network. Run weekly (skill `map-audit`).

## Inputs
- Env or repo-root `.env`: `RETELL_API_KEY`, `CAL_API_KEY` (retell.py); `N8N_BASE_URL`, `N8N_API_KEY` (n8n_backup.py). Names are in `.env.example`; never print values.
- `retell/builds/outbound-speed-to-lead/agent.config.json` (create-outbound).

## Outputs
- retell.py: nothing written locally. With `--apply`: changes in Retell.
- n8n_backup.py: files under `n8n/workflows/` and `n8n/manifest.json`.

## Rules
- Never run `retell.py --apply` without Abdullah's yes on that exact change.
- `repoint-tools` and `create-outbound` can change agent tools: tool changes need their own approval.
- Never point retell.py at Nora or Emily IDs.

## Human check
Read the dry-run output aloud to Abdullah; the yes applies to that output only.
