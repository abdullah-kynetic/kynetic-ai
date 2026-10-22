---
type: process
status: verified
consumes: [context-docs-mirror]
produces: [context-docs-mirror]
verified_on: 2026-10-22
verified_at: 5888b13
---

# end-of-session-docs

Update the three mirror docs so the next session starts from recorded state.

## Steps (`build-log` skill)
1. Reconstruct from the conversation and `git log`; invent nothing.
2. Add a dated entry to `docs/progress.md` and refresh its sections.
3. Add a new D- only for a new decision; never rewrite an old one (mark superseded).
4. Add the next KI-; move fixed ones to Resolved.
5. Check numbers against Twenty before assigning (they can differ).

## If you change this
- **Hits:** [[context-docs-mirror]], `KYNETIC_CONTEXT.md` only if a fact or rule changed.
