# /make-plan

Create a detailed, phased implementation plan with mandatory documentation discovery before any code is written. Use before `/do`.

## When to Call It

- Planning any non-trivial feature or multi-file change
- Before running `/do` on a complex task
- When the right API or pattern is uncertain and needs to be confirmed first

## Workflow

### Phase 0 — Documentation Discovery (always first)

Deploy subagents to:
1. Locate and read relevant documentation, examples, and established patterns
2. Extract actual available APIs, methods, and signatures
3. Compile an "Allowed APIs" reference with documentation sources
4. Flag anti-patterns, non-existent features, and deprecated methods

Orchestrator consolidates into unified Phase 0 output before any implementation planning begins.

### Implementation Phases

Each phase must include:
- **Task definition** — framed as copying from documented patterns, not inventing
- **Documentation citations** — specific file locations and line numbers
- **Verification criteria** — tests or grep checks proving completion
- **Anti-pattern warnings** — APIs to avoid inventing

### Final Phase — Verification

Confirm implementations match documentation, check for anti-patterns, run tests.

## Subagent Reporting Contract

All subagent responses must include:
- Sources consulted (files/URLs)
- Concrete findings (precise API names, signatures, paths)
- Copy-ready snippets with exact file locations
- Confidence assessment including identified gaps

Incomplete reports without evidence trigger redeployment.

## Key Rules

- Documentation existence ≠ correct usage — explicitly read it, don't assume
- Never invent undocumented parameters or methods
- Verification requires evidence, not assumptions

## Works Alongside

`pathfinder` (understand the codebase first), `do` (execute the plan), `smart-explore` (efficient file navigation during discovery).
