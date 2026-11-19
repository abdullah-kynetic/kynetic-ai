# Three workstreams — coordinator log

## Approved scope (2026-11-19)

Abdullah approved parallel execution, maximum three delegates: Free Audit on GPT-6.2 Astra (highest priority); MCP and Design on GPT-6.1 Terra, escalating one model only after two failures. No new PRs authorized. Coordinator reviews and handles serial releases under the approved SAFE/RISKY/DANGEROUS policy; dangerous operations require specific approval. No outbound messages.

Baseline HEAD, origin/work and origin/main: `614b7e40d3dc807a577d617c1c2ceda44b6ce427`. Previous read-only VPS verification matched app/worker image tags, recorded commit and database migration hash through `1091_service_idempotency`. Reverify before release.

## Delegation ledger

All delegates use isolated T3 worktrees, full SAVE/STANDING rules, independent commits and immediate pushes. No child merges/deploys or creates further delegates.

| Workstream | Model | Task identifier suffix | Owned scope | Status |
| --- | --- | --- | --- | --- |
| Free Audit | gpt-6.2-astra | a5989a71-bbb4-4bc9-bbf5-9a9c01b3fab3 | audit engine/report/intake/schema | Launched; completion pending |
| MCP | gpt-6.1-terra | cd3aeaec-2c29-4b35-a96e-52a601a464b7 | mcp server/tests/docs | Launched; completion pending |
| Design | gpt-6.1-terra | 209e93b2-e073-43b2-8af7-493c61fdfabb | Settings then remaining portal design | Launched; completion pending |

Task prefix: `node:delegated-task:command%3Amcp%3A4bdce1ac-1f94-443e-9ba6-b9bbaba24aaa%3Adelegate-task%3A`.

## Acceptance and dependencies

- Audit: prove collector/normalization/storage/render loss points; locate upstream (user supplied placeholder, not a path). Preserve sourced evidence and unavailable-data distinctions. Branded free/full PDF and web reports, transparent estimated impact, service recommendations; intake to durable tenant-authorized stored runs and ready-to-send artifacts. Show six reports for PRI-Premiere Roofing and two eligible local businesses using public research only. Automated tests use synthetic data/fake providers. No sending or production test records.
- MCP: local stdio protocol, 15 reads then precisely five existing service-route writes, client-specific tokens, scopes/idempotency/errors tested. No hosting/DNS or added messaging actions.
- Design: recover sequence, Settings first, finish remaining inventory, responsive/accessibility/form-state visual QA and matching docs. Audit UI remains Audit ownership.
- Coordinator reconciles shared docs and MCP route-coverage interaction if audit-results route is added. Recheck highest main migration before numbering audit additions at 1092+, rebuild journal and test additive migrations. No production backfills.

## Verification and release gates

Each small phase: build, unit/integration, typecheck/lint, local synthetic/e2e and visual/protocol checks as applicable, fix, commit and immediate push, CI on exact SHA. Handoff includes branch/SHAs/files/migrations/tests/artifacts/risks/rollback/unfinished items. Coordinator independently checks acceptance and diff hygiene; build/typecheck alone is insufficient.

Branch CI/protection was absent at setup; CI evidence must be obtained without claiming a branch push ran checks it did not. No repository protection changes are implied. SAFE/RISKY releases serialize after review, using merge commits via work into main, verified DB backup, exact SHA, migrations, health/auth/worker checks, unchanged stub/outbound flags and logs (10 minutes RISKY). Rollback on failed health checks; two failed deploys stop. Destructive migrations/backfills, tenant/compliance changes, server secrets/DNS/provider writes remain approval-gated. Local MCP has no hosted process to deploy.

No implementation or deploy is complete yet. Follow delegate completion events; do not poll running tasks. Record verified phase and deploy results in this log and Honcho. Delegate-specific logs: free-audit.md, mcp-server.md, design-completion.md.

## Scope correction (2026-11-19)

Abdullah requested a pause of all delegates, then explicitly continued only Design and MCP. Cancellation was requested for all three; Design and MCP were confirmed interrupted and resumed in their existing threads on GPT-6.1 Terra. Free Audit remains stopped and excluded from current implementation/release. Preserve its saved branch; do not resume, merge, deploy, or test the audit work. The audit report acceptance and integration above are deferred, not completed. No replacement delegates were created.
