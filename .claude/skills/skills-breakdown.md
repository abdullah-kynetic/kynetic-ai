# Skills Breakdown

Rebuilt 2026-10-17 from what is actually in this repo. Scan the **Trigger Signals** at the start of a conversation; if a task matches, invoke that skill before proceeding.

## In this repo (`.claude/skills/`)

| Skill | One-line summary | Trigger signals |
|---|---|---|
| `build-log` | End-of-session update of `docs/progress.md`, `docs/decisions.md`, `docs/known-issues.md` | "wrap up", "log this", "document what we did", natural end of a work session |
| `retell-builder` | Build or update a Retell voice agent with `tools/retell.py` (dry-run first) | "build a voice agent", "set up Retell", "create/change the Alex outbound agent", new client voice agent |
| `brand-profile` | Skill 1: full Brand Profile from an intake form plus GBP data; the source of truth every downstream skill reads | "new client onboarding", "brand profile", signed client with intake form |
| `demo-profile-generator` | Skill 1, demo mode: Brand Profile from a single `raw-data.json`, no intake form | "demo profile", a `raw-data.json` path or pasted GBP JSON, prospect before outreach |
| `n8n-code-javascript` | JavaScript in n8n Code nodes (modes, data access, return format, helpers). Notes: `DATA_ACCESS.md`, `COMMON_PATTERNS.md`, `ERROR_PATTERNS.md`, `BUILTIN_FUNCTIONS.md` | writing or debugging a Code node, `$input` / `$json` / `$helpers.httpRequest`, `DateTime`, Code node error |
| `icm-architect` | Design or audit a folder as an ICM workspace (RinDig/icm-architect, MIT, markdown only). In this repo use System map mode only; never Restructure without a yes | "map this repo", "audit this folder", "what would a change hit", "ICM this" |
| `map-audit` | Weekly/after-merge audit: runs `tools/map_check.py`, compares docs to Twenty and git, lists stale cards and leftovers. Read-only | "audit the map", "weekly check", "anything stale", "what did we leave behind" |

Known gaps: `brand-profile` and `demo-profile-generator` expect GBP data in a `raw-data.json`, but the scraper (`tools/gbp_scrape.py`) is not in the repo. See the OPEN notes inside those skills.

## Global only (not in this repo)

These come from the user's Claude install, not from this repo. Don't assume they exist in a fresh environment or in n8n.

| Skill | Use for |
|---|---|
| `frontend-design` | Distinctive production-grade frontends |
| `web-artifacts-builder` | React + Tailwind + shadcn/ui HTML artifacts |
| `deep-research` | Multi-source cited research reports |
| `hooked-ux` | Habit-forming product loops (referenced by `brand-profile`) |
| `theme-factory` | Styling artifacts with a theme (referenced by `brand-profile`) |
| `kynetic-ai-brand` | Kynetic AI visual brand for artifacts and decks |
| `brand-profile-generator` | A global copy of Skill 1. The repo's `brand-profile` is the maintained one |

## Removed

The old n8n writeups (`n8n-mcp-tools-expert`, `n8n-workflow-patterns`, `n8n-node-configuration`, `n8n-validation-expert`, `n8n-expression-syntax`, `n8n-code-python`) had no skill folders and are not present anywhere in this repo. The n8n MCP server's own instructions cover that ground. The generic `deep-research` and `frontend-design` copies and the duplicate `brand-profile-generator` were removed from `Claude Skills/`; recoverable via tag `archive/pre-reorg-2026-10-17`.

## Quick lookup

| Task | Skill |
|---|---|
| Wrap up a session | `build-log` |
| Build or change a Retell agent | `retell-builder` |
| Onboard a signed client | `brand-profile` |
| Profile a prospect from GBP data | `demo-profile-generator` |
| Write Code-node JavaScript | `n8n-code-javascript` |
| Frontend UI, artifacts, research | global skills above |
