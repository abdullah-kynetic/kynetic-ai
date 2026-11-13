# Retired DEV material (archived 2026-11-13)

The separate DEV environment (`dev.kyneticai.com`, branch `dev/codex-setup`) was retired on 2026-11-09 PST until after go-live. `main` is the only portal build. Nothing here runs, and nothing here is the plan.

- `docs-codex/`: the old Codex loop's notes and evidence (was `docs/codex/`). `COMPLETION-PLAN.md` is historical evidence, not the roadmap.
- `scripts/`: the DEV deploy and repair scripts (`deploy-dev.sh`, `deploy-dev-server.sh`, `fix-dev-runtime.sh`, `step3-dev-handoff.sh`) and the tests that checked them. They refuse to run.

`crm/deploy/dev/` stays in place because the compose file still names the DEV gates CLI. Use git history for the original paths.
