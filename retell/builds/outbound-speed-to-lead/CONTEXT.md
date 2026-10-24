# outbound-speed-to-lead: Alex, Plan 1

One job: spec the outbound speed-to-lead agent (call a new Meta-ad lead within 60 seconds, qualify, book).

## Inputs
- `PROMPT.md` (Alex prompt), `agent.config.json` (agent, LLM, Cal settings), `FORM_SPEC.md` (lead form), `N8N_MAPPING.md` (n8n node map), `demo-business/` (Kynetic Roofing demo facts).
- Reference: `../../PROMPTING_STYLE.md`, `KYNETIC_CONTEXT.md` (IDs, rules, D-012 call handling).

## Outputs
- Edited specs here, then (with a yes) `python tools/retell.py create-outbound` dry run.

## Rules
- The live agent, LLM and n8n workflow can differ from these files. Check `docs/progress.md` for the published version.
- Cal.com event `7404470`. Never dial the AM-1 Roofing number on the demo company record.
- Disclosure and recording language are required (D-011).

## Human check
Read the dry-run diff of `create-outbound` or the prompt change before any `--apply`.
