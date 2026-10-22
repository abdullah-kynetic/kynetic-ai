---
type: object
cluster: retell
universe: live
status: verified
entity: .claude/settings.json
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Claude allowlist and git identity

`.claude/settings.json` allows `Bash(python tools/retell.py *)` and `python3 tools/retell.py *` with no prompt, and sets the git author/committer env to abdullah-kynetic.

## Why it matters
The pattern matches `--apply`, so Retell writes run without confirmation (AUDIT.md #1). The identity block is what makes commits credit Abdullah.

## If you change this
- **Hits:** [[retell-client]], the `retell-builder` skill, CLAUDE.md commit rules.
- Needs Abdullah's yes (security-relevant setting).
