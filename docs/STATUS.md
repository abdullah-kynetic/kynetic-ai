# STATUS: start here for project status (2026-11-09)

A pointer, not a second scoreboard. Twenty is the business source of truth; this repo holds technical evidence only. On a mismatch, flag both values.

- Plan: Abdullah's five steps. Canonical roadmap = Twenty note `7bfdcb7e`. Frozen checks and weights = note `603fe300` (baseline v1). Current scores = note `5c44b12e`. Twenty twin of this file = note `2489986e` (STATUS).
- Snapshot of the 2026-11-08 scorecard (Steps 1-3 readiness): 23% verified complete, 53% verified incomplete, 24% unverified. Business outcomes are separate: signed clients 0 of 3, opportunities 0, call logs 0.
- Top blockers: live portal `/admin` open (main auth merged, not deployed); no active Alex workflow; counsel sign-off open; pricing conflict D-017 vs D-023 (Twenty decision task `17289c41`); site claims exceed what is live.
- Technical evidence: `docs/audit/2026-11-08-code-evidence.md`. Repo log: `docs/progress.md`, `docs/known-issues.md`. `docs/BUILD_PLAN.md` is technical detail; its Status column is a claim, not acceptance.
- Old checklists and plan docs carry a "Superseded" banner. Twenty task titles carry `[Step N]` or `[LATER]`; old notes are retitled `[ARCHIVED ...]`. Nothing was deleted.

## Update from evidence
1. Get a link with an observation date (PR, CI run, deploy record, curl result, Twenty record id).
2. Set the matching check in Twenty note `5c44b12e` to verified complete, verified incomplete, or unknown with that link. Never change weights in `603fe300`.
3. A task goes DONE only when its check is verified complete; GitHub items close on the same evidence.
4. Recompute percentages; unknown stays in the denominator.
5. Mirror the headline numbers here in a branch and PR (merge commit), and log the change with reversal steps.
6. Scope change = new baseline v2 beside v1, so growth cannot inflate progress.
