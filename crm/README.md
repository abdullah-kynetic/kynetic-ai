# Kynetic Client CRM & Portal

Custom client CRM and portal for Kynetic AI clients. Built from the Kiranism `next-shadcn-dashboard-starter` (MIT; see `LICENSE`). Product, architecture and build rules live in `../docs/` (start with `../AGENTS.md` and `../docs/BUILD_PLAN.md`).

Status: M0 in progress. The app boots with a placeholder shell only. Auth, database and modules arrive in later M0 tasks.

## Commands

Package manager is bun (inherited from the starter; `bun.lock`). Node 22.

| Task | Command |
| --- | --- |
| Install | `bun install --frozen-lockfile` |
| Dev server | `bun run dev` |
| Build | `bun run build` |
| Typecheck | `bun run typecheck` |
| Lint | `bun run lint` |
| Format check | `bun run format:check` |

Test, migrate and seed commands are added by later M0 tasks (M0-02 onward).
