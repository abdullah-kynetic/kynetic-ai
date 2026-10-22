---
type: object
cluster: tooling
universe: live
status: verified
entity: .claude/skills/
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Repo skills

`build-log`, `retell-builder`, `brand-profile`, `demo-profile-generator`, `n8n-code-javascript`, `icm-architect`, plus `skills-breakdown.md` as the trigger table. `brand-profile` and `demo-profile-generator` need `tools/gbp_scrape.py`, which is not in the repo.

## If you change this
- **Hits:** `skills-breakdown.md`, `README.md` layout, `.claude/skills/CONTEXT.md`. `retell-builder` drives [[retell-client]]; `build-log` writes [[context-docs-mirror]].
