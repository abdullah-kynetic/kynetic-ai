# Codex prompt (historical)

Do not follow the paragraph below as the current plan. Current operating order is `docs/STATUS.md`. `dev/codex-setup` is not the default branch, and its `docs/codex/COMPLETION-PLAN.md` is not authority. Main's `docs/codex/PROGRESS.md` is a historical log. Commits stay `abdullah-kynetic <abdullah@kyneticai.com>` with no AI trailer.

Historical instruction, kept so the old loop can be recognized:

Read AGENTS.md and docs/codex/PROGRESS.md. Work on branch dev/codex-setup only (never main). Start at the lowest unchecked step. Build, run `scripts/checks/run.sh <step>`, fix until there are no FAILs (max 3 tries per check, then write a blocker and stop). When the step passes, update PROGRESS.md, commit as abdullah-kynetic with no AI trailer, push the branch, and stop for my review. Do only one step.
