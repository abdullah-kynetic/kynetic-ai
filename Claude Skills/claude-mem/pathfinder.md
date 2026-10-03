# /pathfinder

Orchestrate deep codebase analysis: map features into flowcharts, identify duplicated logic, propose a unified architecture. Evidence-first — no claims without source citations.

## When to Call It

- "Map out how this codebase works"
- Auditing a project before a major refactor
- Finding duplicated logic across features
- Proposing a unified architecture from fragmented code
- Before running `/make-plan` on a complex multi-file change

## Four-Phase Workflow

**Phase 0 — Feature Discovery**
Single subagent walks the source tree and proposes feature boundaries. Orchestrator validates before proceeding.

**Phase 1 — Per-Feature Flowcharts**
Parallel subagents trace the happy path, side effects, and error branches for each feature. Every claim requires `file:line` citation.

**Phase 2 — Duplication Hunt**
Two parallel subagents: one finds within-feature repetition, one finds cross-feature repetition. Each claim needs multiple `file:line` locations.

**Phase 3 — Unified Proposal**
Orchestrator synthesizes findings into a single consolidated design. No abstraction layers added "for flexibility" — simplicity wins.

**Phase 4 — Handoff**
Produces copy-ready `/make-plan` prompts for each unified system, citing exact rewrite locations.

## Subagent Reporting Contract

Every subagent response must include:
- Exact file paths + line ranges consulted
- Concrete findings with specific function names and call sites
- Mermaid diagrams labeled by `file:line`
- Confidence assessment and known gaps

Responses without source citations get redeployed.

## Works Alongside

`make-plan` (plan the refactor), `do` (execute it), `smart-explore` (efficient file navigation during analysis).
