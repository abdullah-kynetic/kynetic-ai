# docs: the mirror of Twenty

> **Current engineering entry point:** [COMPLETION-PLAN.md](codex/COMPLETION-PLAN.md), then [PROGRESS.md](codex/PROGRESS.md). The older read-order below is retained for business history; progress.md is historical. Current user instructions and AGENTS.md govern documentation edits. No Twenty write is authorized by mirroring rules.


One job: record state, decisions and gotchas so a cold session does not guess. Twenty is canonical.

## Files (read first, in this order)
`progress.md` (state) then `decisions.md` (settled) then `known-issues.md` (gotchas). `KYNETIC_CONTEXT.md` is at the repo root.
Point-in-time, not state: `plan1-walkthrough.md`, `counsel-email.md`, `counsel-questions.md`.

## Rules
- Writer: the `build-log` skill at session end. Append a dated entry; do not rewrite past decisions (mark superseded).
- On a mismatch with Twenty, write both values and flag it. New D- and KI- numbers are flagged, not assigned, until Abdullah confirms (Twenty's next D- number may differ from the repo's).
- Keep `progress.md` lean: older log entries are candidates for an archive file (proposal only).

## Human check
Abdullah reads the diff of all three files before merge.
