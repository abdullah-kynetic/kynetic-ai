# System map proposal (icm-architect, System map mode, audit only)

> Historical proposal. This file inventories the retired `portal/` app and old deployment path. The current app is `crm/`, live from `main` at `/opt/portal-new` via `portal-new-deploy`. Quoted commit-trailer lines later in this file are not current rules.

Status: APPLIED on 2026-10-22 at Abdullah's request (sections 4 and 5, plus the safe fixes from section 6: README, KYNETIC_CONTEXT KI-009 line, progress DNS line, skills-breakdown row, `.env.example` n8n names). Not applied: the `.claude/settings.json` allowlist change, the n8n ID fixes (Abdullah: leave for later), any file move. Original text below describes the proposal as made. No existing file was moved, renamed, deleted or rewritten. The only changes on this branch are `.claude/skills/icm-architect/` and this file.
Date: 2026-10-21. Branch: `chore/icm-system-map`, cut from `origin/main` at `67763e6`.
Method: icm-architect `e16cafe` (MIT), System map form, slice 0 (inventory) plus the proposed slice 1 catalog. Slices 2 to 5 (object cards, process cards, effects index, re-verify) are deliberately not run; see section 8.

Scope limits I kept to: read-only on the repo, no call to Twenty, n8n, Retell, Stripe or Cal.com, `tools/retell.py` never run, no secrets read or printed (I read variable names only). Where a fact comes from the project (Abdullah's thread messages, the coordinator note) and not from this repo, it is marked **[project]** and is unverified here.

## 0. About the skill

All 15 files in icm-architect are Markdown (no scripts, no hooks, no `allowed-tools`, no URLs that anything fetches). Nothing in it runs code or calls the network. The only links are to the arXiv paper and a community page in its README. It is instructions to the model, so the risk is behavioral: Restructure mode tells an agent to move and delete files. This proposal never uses it. Suggest a one-line note in `skills-breakdown.md` ("System map mode only; never Restructure without a yes") if you keep it.

## 1. Top-level areas

Universe key (from the skill): **live** = in force, **leftover** = present but not the main path, **ghost** = named but not wired.

| Area | What it is | Universe | Reads | Writes | Live systems it touches |
|---|---|---|---|---|---|
| `CLAUDE.md`, `AGENTS.md` | Agent entry file; `AGENTS.md` is a 5-line pointer (not a drifting copy, good) | live | `docs/*`, `KYNETIC_CONTEXT.md` (by instruction) | nothing | none |
| `KYNETIC_CONTEXT.md` (106 lines) | Rules, pricing, IDs, Retell workspaces, Twenty, portal, bake-off | live | n/a | edited by humans and `build-log` | none, but it is the only place the live IDs are written down |
| `README.md` | Layout table | live (stale in places, section 6) | n/a | n/a | none |
| `docs/` | `progress.md` (147 lines, 23 KB), `decisions.md` (D-001 to D-022), `known-issues.md` (KI-001 to KI-010), `plan1-walkthrough.md`, `counsel-email.md`, `counsel-questions.md` | live; the last three are point-in-time | Twenty (by hand) | `build-log` skill each session | none directly; mirror of Twenty |
| `retell/builds/outbound-speed-to-lead/` | Alex (Plan 1): `PROMPT.md`, `agent.config.json`, `BUILD_PLAN.md`, `FORM_SPEC.md`, `N8N_MAPPING.md`, `demo-business/` | live | n/a | `tools/retell.py create-outbound` reads `agent.config.json` | Retell workspace `abdullahblitz` (agent `agent_71e3cfc8384aa38a910a506b53`), n8n `m2YJwZ1l8DTzyEkw`, Twenty fields, Cal.com event `7404470` |
| `retell/PROMPTING_STYLE.md` | House prompt style | live | n/a | n/a | none |
| `retell/builds/emily-speed-to-lead/` | Emily build copy, paused `[P2]`; `HANDOFF.md`, `snapshot-2026-09-28/` | leftover | n/a | n/a | Retell `kyneticai` (Emily `agent_affef8dcb6880fd592cbe9432f`), n8n `0PwP1tUf4478lNbf` |
| `retell/builds/kynetic-restoration/` | `build-ids.md` for the protected demo | live reference, **no-touch** | n/a | n/a | Retell, n8n (Nora IDs), Twenty demo records |
| `retell/builds/_inflate-original/` | Reference export of the original build (`agent.json`, `llm.json`); contains Nora's agent ID | leftover, "leave alone" | n/a | n/a | none |
| `tools/retell.py` | Retell API client, stdlib Python. Subcommands: `rename-agent`, `set-begin-message`, `set-agent-webhook`, `repoint-tools`, `create-outbound`, plus reads. Dry-run unless `--apply` | live | `RETELL_API_KEY`, `CAL_API_KEY` (env or `.env`), `agent.config.json` | Retell (only with `--apply`), `repoint-tools` rewrites agent tool URLs | **Retell**, Cal.com (event lookup) |
| `tools/n8n_backup.py` | Exports n8n workflows to git. GET only. `--check` for drift | live | `N8N_BASE_URL`, `N8N_API_KEY` (env or `.env`), `n8n/manifest.json` | `n8n/workflows/*`, `n8n/manifest.json` (new ids go to `unsorted/`) | **n8n** (read-only) |
| `n8n/` | Git copy of 52 workflows (15 `active/`, 37 `archive/`), `manifest.json` (id to bucket), `CREDENTIALS.md` (names only), `data-tables/` | live backup; bucket split is **provisional** per its own README | n8n API via the tool | by `n8n_backup.py` | n8n (source), and any future self-hosted import |
| `portal/` | Next.js 16 client portal (portal.kyneticai.com): `src/` (104 files), `tests/`, `drizzle/` (3 migrations), `scripts/`, `deploy/` (12 files), ops docs | live | its own `.env` names (`DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, R2, Google), n8n ingest calls | Postgres, R2, Resend; `deploy/*.sh` run **on the VPS** | **OVH VPS** (`/opt/portal`, Caddy, Docker), Resend, R2, Google OAuth, n8n -> `/api/ingest/results`; no Twenty/Retell calls found in the docs |
| `.claude/settings.json` | Allowlist (`python tools/retell.py *`, `python3 tools/retell.py *`) and the git identity env vars | live | n/a | n/a | **Retell, via the pre-approved allowlist** (section 7, risk 1) |
| `.claude/skills/` | `build-log`, `retell-builder`, `brand-profile`, `demo-profile-generator`, `n8n-code-javascript`, `skills-breakdown.md`, and (this branch) `icm-architect` | live | repo docs | `build-log` edits `docs/*` | `retell-builder` drives `tools/retell.py` |
| `.mcp.json`, `.env.example` | MCP servers (tavily, firecrawl, retell, all `npx ...@latest`) and variable **names** | live | env vars | n/a | Tavily, Firecrawl, Retell |

Workflow-level counts I checked by grepping the saved JSON (names only): in `n8n/workflows/active/`, `outbound-speed-to-lead` is the only workflow that references `retellai` (3 hits) and the main one that references Twenty (25); `pap-products-telegram-inbound-agent` also references Twenty (8); Nora's JSON references cal.com (2). That means Twenty and Retell are reached from n8n and `tools/retell.py`, never from `portal/`.

## 2. How changes ripple (if X changes, check Y)

First-order only. "Outside the tree" items are the ones nothing in the repo names.

| If you change | Also check |
|---|---|
| A fact in `KYNETIC_CONTEXT.md` (ID, price, workspace) | `README.md`, `docs/progress.md`, `docs/decisions.md`, `.claude/skills/retell-builder/SKILL.md` (quotes the rules). **Outside:** the Twenty notes it mirrors (START HERE, READ FIRST) |
| The D-017 price or invoice split | `KYNETIC_CONTEXT.md`, `docs/decisions.md` (D-001 is already marked superseded), `docs/plan1-walkthrough.md`. **Outside:** Twenty dashboard "Plan 1: $30K by Dec 31", Stripe, proposal drafts |
| `retell/builds/outbound-speed-to-lead/PROMPT.md` or `agent.config.json` | `tools/retell.py create-outbound` (reads the config), `N8N_MAPPING.md`, `FORM_SPEC.md`, the prompt version note in `docs/progress.md`. **Outside:** the live Alex agent and LLM in Retell, n8n `m2YJwZ1l8DTzyEkw` (holds the agent ID), Cal.com `7404470`. The repo file is a spec, not the live agent: editing it changes nothing live |
| A Retell agent tool (name, params, URL) | `repoint-tools` in `tools/retell.py`, KYNETIC_CONTEXT rule 2. **Needs a specific yes.** Nora/Emily tools are no-touch |
| `tools/retell.py` behavior or allowlist | `.claude/settings.json` allow rules, `retell-builder` skill, KYNETIC_CONTEXT "Access" |
| A workflow in n8n | re-run `tools/n8n_backup.py --check`; `n8n/manifest.json` if it is new; `n8n/CREDENTIALS.md` if a credential changes; `KYNETIC_CONTEXT.md` node counts and IDs. **Outside:** which n8n instance is canonical (section 6) |
| Moving a workflow between `active/` and `archive/` | `n8n/README.md` says `active/` is the only folder imported to self-hosted n8n, so this decides what gets deployed, including Nora's workflow |
| The portal ingest payload | `portal/N8N.md`, `portal/src/app/api/ingest/`, `portal/tests/`. **Outside:** the n8n workflow that POSTs to it (not in the saved `active/` set; no ingest workflow found by name) |
| `portal/deploy/*.sh` | The server copies in `/usr/local/sbin` and `/opt/portal` are **separate copies** (progress 2026-10-18: the server `set-secrets.sh` was out of date and replaced). Merging to `main` does not update them. Also `BOT_DEPLOY.md`, D-022, KI-010 |
| `portal/drizzle/` migrations | `src/lib/db`, RLS tests in `portal/tests`, the live Postgres on the VPS |
| A skill under `.claude/skills/` | `skills-breakdown.md` trigger table, `README.md` skills row |
| `docs/progress.md` etc. | These mirror Twenty; flag a mismatch, do not pick a side (CLAUDE.md). `build-log` is the only intended writer |

## 3. No-touch list (read-only, propose-only)

Nothing below may be edited, moved, regenerated or called with a write, by any map, card or restructure. IDs are as recorded in `KYNETIC_CONTEXT.md`; I did not look any of them up.

1. **Nora**: agent `agent_4c34644a04c74e27253e80167b`, LLM `llm_d19efe92627f50e48657788b9ff5`, n8n workflow `2PFWFqBM0wabADk6`. In this repo: `n8n/workflows/active/nora-restoration-ai-receptionist__2PFWFqBM0wabADk6.json`, its `manifest.json` entry, and Nora's ID inside `retell/builds/_inflate-original/agent.json` and `retell/builds/kynetic-restoration/build-ids.md`. Note `n8n_backup.py` rewrites that JSON if Nora changes in n8n: that is read-only against n8n, but the file diff should be reviewed, not auto-committed.
2. **Emily**: agent `agent_affef8dcb6880fd592cbe9432f`, LLM `llm_b520d8a6b9bf754f19285a8a6185`, n8n `0PwP1tUf4478lNbf`; `retell/builds/emily-speed-to-lead/` (HANDOFF + snapshot). Paused `[P2]`.
3. **Retell agent tools** on every agent (add, remove, rename, disable, change params): needs approval of that specific change. Code paths that can do it: `tools/retell.py repoint-tools` (URL swap only, any llm id) and, for agent-level fields, `rename-agent`, `set-begin-message`, `set-agent-webhook` (any id, no guard). `create-outbound` only creates a new agent and refuses a name that exists.
4. **Kynetic Restoration (Demo)**: `retell/builds/kynetic-restoration/` and its Twenty records. Plus the AM-1 Roofing office number on the demo company record: never dial.
5. **Production Alex** `agent_71e3cfc8384aa38a910a506b53` and n8n `m2YJwZ1l8DTzyEkw`: not frozen, but live; change only with a yes on the exact change.
6. **Secrets and env**: `.env`, `.env.local`, `.env.*` (gitignored), `/opt/portal/.env` on the VPS, `portal/deploy/set-secrets.sh` inputs, any n8n credential value. `.env.example` files hold names only and are safe to read.
7. **Template workflow** `KYQIVtxwDcXVKmk3` (archive bucket): do not activate or run.
8. **Retired**: `BUILD_LOG.md` is not recreated; legacy material lives only at tag `archive/pre-reorg-2026-10-17`.
9. **Live systems with no-write defaults**: Twenty API GET only unless approved, never REST DELETE, 100 req/60 s; Twenty Cloud untouched until about 2026-10-29.

## 4. CONTEXT.md files I would add (not created)

Design call: this repo is small (260 tracked files, 104 of them one Next.js app). The skill says to stop at one `CONTEXT.md` plus an index for a tree this size, and not to scaffold `map/objects/`, `processes/` or `effects/`. So I propose **seven short CONTEXT.md files placed in the areas themselves**, and no `map/` shelf. Each is a contract (reads / writes / live systems / human check), written to be 150 to 300 tokens. The no-touch list in section 3 would live in the root `CLAUDE.md` pointer plus `KYNETIC_CONTEXT.md`, not a new file.

### 4.1 `tools/CONTEXT.md`

```markdown
# tools: scripts that talk to live systems

One job: small stdlib-Python clients. Check here before writing a new script.

## Files
- `retell.py`: Retell API client. Every write is a dry run unless `--apply`.
- `n8n_backup.py`: exports n8n workflows into `n8n/workflows/`. GET only.

## Inputs
- Env or repo-root `.env`: `RETELL_API_KEY`, `CAL_API_KEY` (retell.py); `N8N_BASE_URL`, `N8N_API_KEY` (n8n_backup.py). Names are in `.env.example`; never print values.
- `retell/builds/outbound-speed-to-lead/agent.config.json` (create-outbound).

## Outputs
- retell.py: nothing written locally. With `--apply`: changes in Retell.
- n8n_backup.py: files under `n8n/workflows/` and `n8n/manifest.json`.

## Rules
- Never run `retell.py --apply` without Abdullah's yes on that exact change.
- `repoint-tools` and `create-outbound` can change agent tools: tool changes need their own approval.
- Never point retell.py at Nora or Emily IDs.

## Human check
Read the dry-run output aloud to Abdullah; the yes applies to that output only.
```

### 4.2 `n8n/CONTEXT.md`

```markdown
# n8n: git copy of the workflows

One job: keep a restorable copy of the n8n workflows. This folder is not the live system.

## Inputs
- Working: n8n API, through `python tools/n8n_backup.py` (read-only).
- Reference: `manifest.json` (id to bucket), `CREDENTIALS.md` (credential names only).

## Outputs
- `workflows/active/` live or in testing. `workflows/archive/` reference only, never deployed. `workflows/unsorted/` new, not yet placed.

## Rules
- Bucket split is provisional (see README). Abdullah decides the final split.
- `active/` is the folder that would be imported to a self-hosted n8n. It currently includes Nora (`2PFWFqBM0wabADk6`): do not import or edit it without a yes.
- Which n8n instance is canonical is an open question; see `docs/icm/system-map-proposal.md` section 6.
- No secrets are stored; credentials are recreated by hand on a new instance.

## Human check
Run `python tools/n8n_backup.py --check`; review the diff before committing. Expect Nora's file to change only if Nora changed in n8n.
```

### 4.3 `retell/CONTEXT.md`

```markdown
# retell: voice agent builds and prompt style

One job: hold the specs for Retell voice agents. The live agents are in Retell, not here.

## Map
- `builds/outbound-speed-to-lead/`: Plan 1 Alex (live spec). Start at `BUILD_PLAN.md` "Current state".
- `builds/emily-speed-to-lead/`: Plan 2 Emily, paused.
- `builds/kynetic-restoration/`: protected demo IDs. Do not edit.
- `builds/_inflate-original/`: reference export. Leave alone.
- `PROMPTING_STYLE.md`: house style for any prompt.

## Rules
- Two Retell workspaces: `abdullahblitz` (new builds, Alex) and `kyneticai` (Nora, Emily). IDs: `KYNETIC_CONTEXT.md`.
- Repo files are specs. Changing one changes nothing live. Live changes go through `tools/retell.py` dry-run, then a yes.
- Never add, remove, rename or change parameters of an agent tool without approval of that change.
- Never touch Nora, Emily, or the Kynetic Restoration (Demo) build.

## Human check
Compare the prompt version in `PROMPT.md` with the version recorded in `docs/progress.md` before saying what is live.
```

### 4.4 `retell/builds/outbound-speed-to-lead/CONTEXT.md`

```markdown
# outbound-speed-to-lead: Alex, Plan 1

One job: spec the outbound speed-to-lead agent (call a new Meta-ad lead within 60 seconds, qualify, book).

## Inputs
- `PROMPT.md` (Alex prompt), `agent.config.json` (agent, LLM, Cal settings), `FORM_SPEC.md` (lead form), `N8N_MAPPING.md` (n8n node map), `demo-business/` (Kynetic Roofing demo facts).
- Reference: `../../PROMPTING_STYLE.md`, `KYNETIC_CONTEXT.md` (IDs, rules, D-012 call handling).

## Outputs
- Edited specs here, then (with a yes) `python tools/retell.py create-outbound` dry run.

## Rules
- The live agent, LLM and n8n workflow can differ from these files. Check `docs/progress.md` for the published version.
- Cal.com event `7404470`. Never dial the AM-1 Roofing number on the demo company record.
- Disclosure and recording language are required (D-011).

## Human check
Read the dry-run diff of `create-outbound` or the prompt change before any `--apply`.
```

### 4.5 `portal/CONTEXT.md`

```markdown
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
```

### 4.6 `docs/CONTEXT.md`

```markdown
# docs: the mirror of Twenty

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
```

### 4.7 `.claude/skills/CONTEXT.md`

```markdown
# skills: repo-local Claude skills

One job: route a task to a skill. Trigger table: `skills-breakdown.md`.

## Rules
- `retell-builder` drives `tools/retell.py` (dry-run first). `build-log` is the only skill that writes `docs/*`.
- `icm-architect` is for System map mode only here. Never Restructure mode; never move or delete files without a yes.
- `brand-profile` and `demo-profile-generator` need `tools/gbp_scrape.py`, which is not in the repo (known gap).
- Adding or removing a skill: update `skills-breakdown.md` and the `README.md` layout row.
```

## 5. Proposed root `CLAUDE.md` rewrite (under 60 lines; shown as a diff, not applied)

The proposed file is 37 lines (current: 44). Net effect: same hard rules, adds a "where things live" routing table that points at the CONTEXT.md files above, drops prose duplicated elsewhere. What moves out of CLAUDE.md and where it already lives: the Retell MCP / Deno note (`docs/known-issues.md` Gotchas), the "never a gmail address" detail (it is in the commit-identity env in `.claude/settings.json`; restore the clause if you want it explicit), and the Plan 1 file list (now in `retell/builds/outbound-speed-to-lead/CONTEXT.md`).

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md (proposed)
@@ -1,44 +1,37 @@
 # Agent Instructions
 
+Kynetic AI repo. Twenty CRM (crm.kyneticai.com) is the system of record; this repo mirrors it. On a mismatch, flag it with both values rather than picking one. `AGENTS.md` points here.
+
 ## Session protocol
 
-Read these at the start of every session, before anything else:
+Read before anything else: `docs/progress.md` (state; never assume state that isn't recorded), `docs/decisions.md` (settled; disagree out loud and wait), `docs/known-issues.md` (gotchas; don't fix on your own initiative), `KYNETIC_CONTEXT.md` (rules, IDs, pricing; never guess an ID or price).
 
-1. `docs/progress.md`: where we are. Never assume state that isn't recorded.
-2. `docs/decisions.md`: settled. Don't reopen; if you disagree, say so and wait.
-3. `docs/known-issues.md`: gotchas. Don't "fix" them on your own initiative.
-4. `KYNETIC_CONTEXT.md`: rules, IDs, pricing, frozen and off-limits items. Never guess an ID or price.
+## Hard rules
 
-Twenty CRM (crm.kyneticai.com) is the system of record. These files mirror it. On a mismatch, flag it rather than silently picking one.
+- Before any live-system change (n8n, Retell, Twenty, Cal.com, Stripe, VPS, DNS, email), state the exact change and wait for a yes on that change. Read-only investigation is fine.
+- No-touch: Nora (agent + workflow), Emily, Retell agent tools, Kynetic Restoration (Demo) records and `retell/builds/kynetic-restoration/`, `.env` files and secrets. IDs: `KYNETIC_CONTEXT.md`.
+- Never commit or print secrets (`.env` or the cloud environment only).
+- Outreach is phone only, by a human (D-007). Never dial the AM-1 Roofing number.
 
-Before any live-system change (n8n, Retell, Twenty, VPS), state the exact change and wait for a yes on that change. Read-only investigation is fine.
+## Where things live (read the folder's CONTEXT.md before editing in it)
 
-Check `tools/` for an existing script before writing a new one.
+| Task | Go to |
+|---|---|
+| Change the Alex agent or prompt | `retell/builds/outbound-speed-to-lead/`, `retell/PROMPTING_STYLE.md`, skill `retell-builder` |
+| Call the Retell API | `tools/retell.py` (dry-run unless `--apply`) |
+| Back up or compare n8n workflows | `n8n/`, `tools/n8n_backup.py` (read-only) |
+| Client portal code or deploy | `portal/` (its own `AGENTS.md`) |
+| Decisions, state, issues | `docs/` |
+| Skills | `.claude/skills/skills-breakdown.md` |
 
-Never commit secrets (`.env` or the cloud environment only).
+Check `tools/` for an existing script before writing one. At the start of a conversation scan the trigger signals in `.claude/skills/skills-breakdown.md`.
 
-At the end of every session, update `docs/progress.md`, `docs/decisions.md` and `docs/known-issues.md` (short, dated, no duplicates). Update `KYNETIC_CONTEXT.md` only if a fact or rule changed. The `build-log` skill does this. Do not recreate `BUILD_LOG.md`; that SeldonFrame-era log was retired and is recoverable from tag `archive/pre-reorg-2026-10-17`.
+## Commits and PRs
 
-## How to operate
+- Author and committer: `abdullah-kynetic <abdullah@kyneticai.com>`. Check `git var GIT_AUTHOR_IDENT` first; if wrong, set `user.name` and `user.email`.
+- At most one trailer: `Co-authored-by: Claude <noreply@anthropic.com>`. No "Generated by" footers.
+- Small, separate commits on a branch. Merge PRs with a merge commit (`gh pr merge --merge`), never squash or rebase. Never rewrite history on `main`.
 
-`tools/retell.py` is the Retell client (stdlib Python, `RETELL_API_KEY` from the environment or `.env`). It dry-runs every write unless `--apply` is passed. The Retell MCP in `.mcp.json` runs through `npx`, but its code tool needs Deno on PATH, so it is optional and often unavailable. Prefer `tools/retell.py`.
+## End of session
 
-Do not modify Nora's agent, LLM, or workflow. Do not edit or delete the Kynetic Restoration (Demo) build at `retell/builds/kynetic-restoration/`.
-
-Plan 1 files to keep current: `retell/builds/outbound-speed-to-lead/`, `tools/retell.py`, `retell/PROMPTING_STYLE.md`.
-
-## Commits
-
-Every commit must credit Abdullah's GitHub account. Author and committer are `abdullah-kynetic <abdullah@kyneticai.com>`, never `Claude <noreply@anthropic.com>` and never a gmail address (that links to a different GitHub account). `.claude/settings.json` sets this through the `GIT_AUTHOR_*` and `GIT_COMMITTER_*` env vars. Before the first commit, check with `git var GIT_AUTHOR_IDENT`. If it is wrong, run `git config user.name abdullah-kynetic && git config user.email abdullah@kyneticai.com`.
-
-At most one trailer: `Co-authored-by: Claude <noreply@anthropic.com>`. No other co-authors and no "Generated by Claude Code" footers in commits or PR bodies.
-
-Keep commits small and separate. Merge PRs with a merge commit (`gh pr merge --merge`), never squash or rebase-merge. Do not rewrite history on `main`.
-
-## Skills
-
-At the start of a conversation, read `.claude/skills/skills-breakdown.md` and scan the Trigger Signals. Repo skills live in `.claude/skills/`.
-
-## Layout
-
-See `README.md`. `AGENTS.md` points here so every agent session uses the same rules.
+Run skill `build-log`: update `docs/progress.md`, `docs/decisions.md`, `docs/known-issues.md` (short, dated, no duplicates). Update `KYNETIC_CONTEXT.md` only if a fact or rule changed. Do not recreate `BUILD_LOG.md`.
```

## 6. Contradictions and stale docs

Ordered by how likely they are to mislead an agent into a live action. "Repo" = checked out at `67763e6`. **[project]** = from the project thread, not verifiable in this repo.

1. **n8n: "planning only" vs a real VPS migration, and two n8n instances with different IDs.** `docs/progress.md` (Next, 3.10) and `KYNETIC_CONTEXT.md` (Portal section: "Planned, not started: self-hosting n8n here") say planning only. `KYNETIC_CONTEXT.md` Access still lists only the n8n cloud URL. `n8n/README.md` and `tools/n8n_backup.py` describe importing `active/` into a self-hosted instance at `https://n8n.kyneticai.com` (`n8n/CREDENTIALS.md`). **[project]** the coordinator note says the canonical n8n is the VPS instance with the speed-to-lead workflow `tXJwNTkNgKGnp0Ab`, not the cloud `m2YJwZ1l8DTzyEkw`; the audit thread says the VPS copy is inactive while the cloud copy was still active. `tXJwNTkNgKGnp0Ab` appears nowhere in the repo, while `m2YJwZ1l8DTzyEkw` appears in `KYNETIC_CONTEXT.md`, `docs/*`, `retell/.../N8N_MAPPING.md` and the saved JSON. **Question 1 below.**
2. **Go-live state of "Outbound Speed to Lead".** `KYNETIC_CONTEXT.md` says "found active ... Go-live is not yet approved; Abdullah to confirm (KI-009)". `docs/known-issues.md` KI-009 and `progress.md` say approved 2026-10-18 and resolved. The context file is the stale one.
3. **Decision numbering.** `README.md` says "D-001 through D-019"; `docs/decisions.md` runs to D-022. **[project]** Twenty's START HERE says the next number is D-021, but the repo already has D-021 and D-022. Also out of order in the file: D-016 before D-015, D-014 before D-011 (cosmetic, but agents grep by number).
4. **Portal DNS and Resend.** `progress.md` "Done" still says for PR #15 "DNS A record not set"; KI-006 and the Oct 17 log say it is set and Resend works (closed 2026-10-17). `KYNETIC_CONTEXT.md` is already correct.
5. **Bake-off tracked on branches, not main.** `KYNETIC_CONTEXT.md` and `progress.md` describe Retell vs Bland vs ElevenLabs and name ElevenLabs agent `agent_9301m52zy185e609f8vyws4r1r7q`; `providers/` is not on main (it is on `claude/provider-test-elevenlabs`, 18 files). **[project]** Abdullah's later brief says Bland was dropped and the live ElevenLabs agents are v1 `agent_8201m5afn2rbeb7v29xfkhh1pjef` and v2 `agent_9701m5afn5rxehardsqttkq3pbjh`, and the Twenty note title is now "Retell vs ElevenLabs". Do not use the repo's ElevenLabs ID without checking Twenty.
6. **Alex prompt version.** `KYNETIC_CONTEXT.md` and `progress.md` say v1.2.3 is only on `claude/alex-demo-live-test` (`a247264`, 2026-10-16), "not merged or published". `retell/builds/outbound-speed-to-lead/PROMPT.md` on main carries no version number and calls itself "DRAFT for review. Not applied to Retell". Which version is live in Retell is not recorded in the repo.
7. **Nora row says "(live, Notion)".** `KYNETIC_CONTEXT.md` Retell table. Notion is declared legacy in the same file; Nora's JSON still lists Notion credentials in `n8n/CREDENTIALS.md`. Not a conflict, but an agent might design Notion logging from it.
8. **`.env.example` is missing `N8N_BASE_URL` and `N8N_API_KEY`**, which `tools/n8n_backup.py` and `n8n/README.md` require (0 `N8N` matches in the file).
9. **`n8n/workflows/active/` is not "live".** It holds demo and one-off workflows (Great Clips, Seekers, Pap Products, Porchlight, Riley) because the initial sort was "active on cloud". `n8n/README.md` flags this as provisional but also says `active/` is the only folder imported to self-hosted n8n. Read together, a mechanical import would deploy Nora and several client demos.
10. **Deploy bot / GitHub Action has no source in the repo.** `portal/deploy/BOT_DEPLOY.md`, D-022 and KI-010 describe a deploy bot or GitHub Action that connects with a forced-command key; `.github/` does not exist. The trigger lives outside the repo, so a ripple from `portal/deploy/` cannot be traced from here.
11. **Skills with a missing dependency.** `brand-profile` and `demo-profile-generator` need `tools/gbp_scrape.py`, which is not in the repo (acknowledged in `skills-breakdown.md`).
12. **Branch sprawl.** 49 remote branches, many `claude/*`. Several docs say "on branch X, not merged" (alex prompt, providers). That is state living in git refs, invisible to anyone reading only the four context files.
13. **Session-start cost.** The four required files total 35 KB (`progress.md` 23 KB alone); the skill's healthy range is 2k to 8k tokens per step. `progress.md` is mostly log history. Proposal only: split the dated Log into an archive file and keep Current/Done/In progress/Next/Blockers.

## 7. Top 5 risks

1. **The allowlist pre-approves `--apply`.** `.claude/settings.json` allows `Bash(python tools/retell.py *)`. That matches `... repoint-tools ... --apply` and `create-outbound --apply`, so an agent can write to Retell (including agent tools) with no permission prompt. The repo rule ("wait for a yes") is instruction-only. Suggest narrowing the allow to read subcommands and leaving `--apply` to prompt; needs your decision (changes settings).
2. **Two n8n instances and unclear canonical IDs** (section 6.1). An agent following `KYNETIC_CONTEXT.md` will target cloud `m2YJwZ1l8DTzyEkw`; the canonical copy may be on the VPS under a different ID. A "fix" or activation on the wrong one is a live change.
3. **`n8n/workflows/active/` bundles Nora and demo clients** and is documented as the import set for self-hosted n8n. A bulk import would duplicate Nora's live webhooks/Twilio triggers (frozen) on a second instance.
4. **Portal deploy scripts exist in two places** (repo and `/usr/local/sbin`, `/opt/portal`), plus a trigger with no source in the repo. Merging a `portal/deploy/` change does nothing until someone copies it, and nothing in the repo shows who does. Portal still must not hold real client data (KI-006, KI-008).
5. **State lives in unmerged branches and Twenty notes**: bake-off IDs, Alex prompt version, `tXJwNTkNgKGnp0Ab`. The mirrors on `main` are already out of sync (section 6.2, 6.5, 6.6), and the session protocol tells agents to trust them first.

Honorable mentions: `.mcp.json` runs three `npx ...@latest` servers (unpinned); `portal/` still carries the dev Postgres password in `scripts/pg-embedded.mts` (KI-008 asks whether the VPS reuses it).

## 8. What I did not do, and why

- No `map/` shelf, no object or process cards, no effects index. For 260 files with a handful of real movements, the skill itself says to stop at a CONTEXT.md plus an index. If you want cards later, the first clusters would be: Alex (prompt, config, agent, workflow), Lead (Twenty fields, n8n nodes, Cal event), Portal (auth, tenancy, ingest, deploy). The only processes that actually run are: build/change Alex, back up n8n, deploy the portal, end-of-session docs.
- Slice 5 (re-verify) was only done for claims I flagged `[project]`: I could not verify them without calling a live system.
- No file was moved or renamed, so the skill's reference-integrity gate (case-folded destinations, referrer search) was not needed. If any move is later proposed from this document, run that gate first.

## 9. Questions I need answered before applying anything

1. ~~Which n8n is canonical?~~ Answered per the coordinator (project memory, Abdullah, 2026-10-21): the VPS workflow `tXJwNTkNgKGnp0Ab` is canonical and the cloud ID `m2YJwZ1l8DTzyEkw` in the repo is stale. Still open: is anything still live on cloud, and may the ID fixes in `KYNETIC_CONTEXT.md` and `docs/` be applied?
2. Should `n8n/workflows/active/` stay the self-host import set, or should Nora and the client demos move to a "do not import" bucket first?
3. May I narrow the `retell.py` allowlist so `--apply` always prompts? (A `.claude/settings.json` change.)
4. Adopt the seven CONTEXT.md files as written, a subset, or none? And is a `map/` shelf wanted at all?
5. Apply the `CLAUDE.md` diff as is, or keep the "never a gmail address" and Deno notes inline?
6. Who triggers `portal-deploy` (the GitHub Action or bot): where does that definition live, and should a copy go in the repo?
7. Which D- number is next: Twenty's D-021 or the repo's D-023? (Flag only; I assigned none.)
8. Which ElevenLabs agent IDs and Alex prompt version are current, so the stale lines in `KYNETIC_CONTEXT.md` can be corrected from Twenty?
