# Kynetic Client CRM & Portal

Custom client CRM and portal for Kynetic AI clients. Built from the Kiranism `next-shadcn-dashboard-starter` (MIT; see `LICENSE`). Product, architecture and build rules live in `../docs/` (start with `../AGENTS.md` and `../docs/BUILD_PLAN.md`).

Status: the current `main` build is the production CRM/portal line at
`https://portal.kyneticai.com`. It includes the client workspace, staff admin
workspace, agency workspace, tenant isolation, appointments, support threads,
documents, reports, operations controls, and the agency sales tools. Migration
`1019_support_threads_category` is the latest migration; the next free number
is `1020`.

Authentication is invite-only: clients use emailed one-time sign-in codes and
staff use an authenticator app enrolled from a QR code. Recovery codes,
password sign-in, and Google sign-in are not part of the current flow.

Production deploys use `crm/deploy/portal-new/portal-new-deploy` and the
`/opt/portal-new` stack. Do not deploy from this README without explicit
authorization.

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

Test, migrate and seed commands are available from `package.json`; migrations
are reviewed and numbered in `crm/drizzle/`.
