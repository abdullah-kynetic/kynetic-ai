---
type: object
cluster: retell
universe: live
status: verified
entity: .claude/settings.json
verified_on: 2026-10-22
verified_at: d417246 (settings narrowed in bd35a17)
---

# Claude allowlist and git identity

`.claude/settings.json` allows only `get-agent`, `get-llm` and `snapshot` of `tools/retell.py` with no prompt, and sets the git author/committer env to abdullah-kynetic.

## Why it matters
Narrowed 2026-10-22 (Abdullah approved): only `get-agent`, `get-llm` and `snapshot` run without a prompt, so every write, `--apply` and dry-run included, now asks first (docs/plans/AUDIT.md #1, fixed). The identity block is what makes commits credit Abdullah.

## If you change this
- **Hits:** [[retell-client]], the `retell-builder` skill, CLAUDE.md commit rules.
- Needs Abdullah's yes (security-relevant setting).
