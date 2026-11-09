# docs: the mirror of Twenty

> Status entry point: `docs/STATUS.md` (five-step order, offer, pricing precedence, scorecard pointer). This folder does not keep a second roadmap.

One job: record state, decisions and gotchas so a cold session does not guess. Twenty is the business source of truth. GitHub is the technical execution record.

## Files (read first, in this order)
`STATUS.md` (current direction) then `progress.md` (dated log; headings marked historical are history) then `decisions.md` (history plus the 2026-11-09 precedence note) then `known-issues.md` (gotchas). `KYNETIC_CONTEXT.md` is at the repo root.
Point-in-time, not state: `plan1-walkthrough.md`, `counsel-email.md`, `counsel-questions.md`, `lead-engine-handoff.md`.
Portal technical requirements (`PRD.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `BUILD_PLAN.md`, and the sibling spec docs) describe the codebase. Their Lite/Full prices are historical commercial terms. They are not the business roadmap.
`codex/PROGRESS.md` on main is a historical Codex log. `codex/COMPLETION-PLAN.md` exists only on branch `dev/codex-setup` and is not authority. Do not merge that file in as the plan.

## Rules
- Writer: the `build-log` skill at session end. Append a dated entry; do not rewrite past decisions (mark superseded). New D-numbers stay unassigned when Twenty's sequence may differ. The 2026-11-09 precedence note is the current operating record and does not claim a Twenty D-number.
- On a mismatch with Twenty, write both values and flag it. This 2026-11-09 pass did not read Twenty.
- Keep `progress.md` lean: older log entries are candidates for an archive file (proposal only). Do not delete them in a cleanup pass.

## Human check
Abdullah reads the diff of the status, progress, decisions, and known-issues files before merge.
