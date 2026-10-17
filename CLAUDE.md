# Agent Instructions

## Read first (every session)

- `docs/progress.md` (where we are)
- `docs/decisions.md` (what is already decided, do not reopen)
- `docs/known-issues.md` (gotchas, do not "fix" these)
- `KYNETIC_CONTEXT.md` (rules, IDs, pricing, Retell workspaces, frozen Nora vs Emily)

Twenty is the system of record. These docs mirror it; if they disagree, Twenty wins.
At the end of a session, update the three docs files. Do not recreate `BUILD_LOG.md`; that SeldonFrame-era log is in `archive/`.

## How to operate

Look for an existing script in `tools/` before writing a new one. `tools/retell.py` is the Retell client (stdlib Python, `RETELL_API_KEY` from the environment or `.env`). It dry-runs every write unless `--apply` is passed. The Retell MCP needs Deno and is optional.

Tell Abdullah before any change to n8n, Retell, or Twenty, and wait for a yes on that specific change. Read-only investigation is fine.

Do not modify Nora's agent, LLM, or workflow. Do not edit or delete the Kynetic Restoration (Demo) build at `retell/builds/kynetic-restoration/`.

Plan 1 files to keep current: `retell/builds/outbound-speed-to-lead/`, `tools/retell.py`, `retell/PROMPTING_STYLE.md`.

Secrets live in `.env` or the cloud environment. Never commit them.

## Commits

Every commit must credit Abdullah's GitHub account `abdullah-kynetic`. Author and committer are `abdullah-kynetic <abdullah@kyneticai.com>`, never `Claude <noreply@anthropic.com>` and never a gmail address (that links to a different GitHub account). `.claude/settings.json` sets this through the `GIT_AUTHOR_*` and `GIT_COMMITTER_*` env vars. Before the first commit, check with `git var GIT_AUTHOR_IDENT`. If it is wrong, run `git config user.name abdullah-kynetic && git config user.email abdullah@kyneticai.com`. A `Co-Authored-By: Claude` trailer is fine.

Keep commits small and separate. Merge PRs with a merge commit (`gh pr merge --merge`), never squash. Do not rewrite history on `main`.

## Skills

At the start of a conversation, read `Claude Skills/skills-breakdown.md` and scan the Trigger Signals. Kynetic delivery skills are in `.claude/skills/` (`brand-profile`, `retell-builder`, `build-log`).

## Layout

See `README.md`. `AGENTS.md` points here so every agent session uses the same rules.
