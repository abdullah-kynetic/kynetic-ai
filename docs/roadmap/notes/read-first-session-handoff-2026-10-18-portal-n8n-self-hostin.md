# [ARCHIVED 2026-11-09, superseded by ROADMAP 7bfdcb7e] READ FIRST — Session Handoff (2026-10-18, portal + n8n self-hosting)

_Twenty note `c19135dc`, created 2026-10-18, updated 2026-11-09. Exported 2026-11-12._

**Read first:** docs/progress.md (top log entry, 2026-10-18), docs/decisions.md (D-021, D-022), docs/known-issues.md (KI-005, KI-006), portal/ADMIN.md, and the Twenty note "Portal status: 2026-10-18".

**State.** Portal is live at `bdc4afe`: two-step admin login, Remember this device (30 days, admin only), invites sign the user straight in, Google sign-in for invited clients. VPS is at 14% disk with Bookstack and Docmost removed. Remaining KI-006 gaps: DB passwords in the container environment, no off-server backups or restore test, client A/B isolation test.

**Rules still in force.** No n8n, Retell, Twenty or Notion change without Abdullah's yes on that specific change. Commits as `abdullah-kynetic`, merge-commit PRs, never squash. Abdullah wants his real commits visible on GitHub, so keep work in separate commits.

**Main task for the next session: plan self-hosting n8n on the OVH VPS.** Step 1 (read-only): export the workflows from n8n cloud and measure them. Step 2: a written plan covering backups, the lead-form and Retell post-call webhook URLs, credentials, HTTPS, and a rollback path. Do not migrate anything without approval.

**Waiting on Abdullah.** His to-do: admin recovery codes; invite, forgot-password, Users-tab and Google tests with the two test addresses; the client A/B isolation test.
