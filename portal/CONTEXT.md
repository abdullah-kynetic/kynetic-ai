# portal: client portal (Next.js)

One job: invite-only portal where each client sees only their own data. Live at portal.kyneticai.com on the OVH VPS.

## Map
- `src/app` routes, `src/lib` (auth, db, storage, actions), `tests/`, `drizzle/` migrations, `scripts/` (dev and admin), `deploy/` (scripts that run on the VPS).
- Ops: `ADMIN.md`, `N8N.md` (ingest API), `deploy/BOT_DEPLOY.md`. Next.js rules: `AGENTS.md`.

## Rules
- Repo-wide rules are in the root `CLAUDE.md`. No real client data until KI-006 and KI-008 are closed.
- Tenant is resolved server-side; Postgres RLS is forced. Do not weaken either.
- Deploy only through server-side `portal-deploy` of a merged commit on `main` (D-022).
- `deploy/*.sh` on the VPS are separate copies; a merge does not update them.
- Never read or print `.env`, `/opt/portal/.env` or `set-secrets.sh` inputs.

## Human check
Run `npm run lint`, typecheck and `vitest run` from a non-root user copy before proposing a deploy.
