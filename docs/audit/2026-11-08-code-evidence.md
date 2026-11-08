# Code and deployment evidence ledger, 2026-11-08

Observed 2026-11-08 22:30-23:10Z by the "Audit code and deployment evidence" thread. Read-only on every live system. No project code, migration or test was executed; test and CI evidence below is attributable GitHub Actions output or a quoted self-report, labelled as such.

Levels used: **DOC** documented only; **BRANCH** implemented on an unmerged branch; **MERGED** on main; **TESTED** attributable CI run on that commit; **DEPLOYED** observed running; **VERIFIED** observed working end to end. Each row also says FACT (I read or observed it), INFERENCE, or UNKNOWN.

## 0. Coverage and limits

- Repo inventoried: `abdullah-kynetic/kynetic-ai` only (the only repo in scope). 170 remote branches (fetched), 9 open PRs, 137 PRs total (all pages, via `gh api --paginate`), **0 issues** (every number 1-137 is a PR), **0 milestones**. GitHub Projects/boards and the Deployments API returned 404/403 through this integration, so boards and GitHub-recorded deployments are UNKNOWN.
- CI: workflow files `crm-ci.yml`, `crm-image.yml`, `crm-preview.yml` (all gated on `crm/**` paths). Actions runs exist only for main and PR branches. **No run exists for `dev/codex-setup`, `feat/positioning-remodelers`, `claude/project-thread-x5righ`, `claude/project-thread-kj2v2h` or `feat/brand-revamp`** (no PR or no path match), so none of their test claims are CI-backed.
- Live probes (read-only GET, 2026-11-08 ~22:35Z): `portal.kyneticai.com/admin` 200, `/` 307 to `/dashboard`, `/api/health` 200. n8n VPS `search_workflows` (names and active flags only). Not probed: Twenty (other thread), Stripe (sign-in expired), Twilio, ElevenLabs, Cal.com, VPS internals, Cloudflare.
- Git author: `git var GIT_AUTHOR_IDENT` in this container shows `Abdullah Ahmed <abdullah@kyneticai.com>` (environment override of the name, known). Commits for this audit set the name explicitly; see change journal for what actually landed.

## 1. Headline findings

1. **The "Codex steps 3-6 not done" statement is true of main only.** Branch `dev/codex-setup` (99 commits ahead of main, last commit 2026-11-06, no PR, no CI) records steps 3 (lead to booking chain), 4 (texts and alerts) and 5 (onboarding docs) ticked, plus agency steps 7, 8, 10, 11, 12 and a 570-line `docs/codex/COMPLETION-PLAN.md`. Main's `docs/codex/PROGRESS.md` stops at step 2. That work is BRANCH, self-reported, not merged, not CI-tested.
2. **Competing roadmap exists in-repo:** `dev/codex-setup:docs/codex/COMPLETION-PLAN.md` (ten steps, all PARTIAL, step 10 BLOCKED) and `docs/codex/CURRENT_STATUS.md`. It is a technical evidence index, not the business plan. Twenty stays canonical; this should be linked as technical detail only.
3. **Live portal is not protected.** `/admin` returns 200 with no sign-in today. Live is `350bf67` (11-03, open mode). Main `49019b93` has verified sessions and staff TOTP and passed CI, but is not deployed.
4. **PR #113 is not obsolete.** Main has its own `mergeContacts` (`crm/src/server/contacts/service.ts:388`) that copies every consent row, grants included, to the survivor (`:445-451`) and writes no consent-state audit entry. That contradicts the 2026-10-26 M1-08 decision (grants never carry, opt-outs and DNC carry, audit both records' consent state). Decision text is in #113's `DC-112` row only, not in main.
5. **Website source is not on main.** Live www was deployed from `feat/positioning-remodelers` (be91ac49, 128 ahead of main); `claude/project-thread-x5righ` (146 ahead, 11-06) and `claude/project-thread-qptdya` hold newer site work. #136 is the only open PR path for the Astro site and is a strict ancestor of the live branch.
6. **Systems-build work** (sandbox policy engine, DEV n8n `MOqT97N0ItVyKIno`) is on `claude/project-thread-kj2v2h` (2 commits ahead of main, no PR).

## 2. Evidence ledger

| # | Claim | Level | Evidence (path:line @ sha, link, observation) | Type |
|---|---|---|---|---|
| A1 | Main restores verified-session auth; anonymous admin removed | MERGED, TESTED | `crm/src/server/auth/index.ts` `getSessionUser` uses `getVerifiedSessionUser`; `crm/src/proxy.ts:34-47` returns 401/403 for `/admin` and `/api/admin`, redirects `/dashboard` to `/sign-in`; `crm/src/server/admin/guard.ts` requires Kynetic role and TOTP. @49019b93. CI run 41948514258 (2026-11-05): job `check` success (typecheck, lint, format, unit, integration, build, deploy-script rehearsal), job `e2e` success | FACT |
| A2 | Persona switching cannot run in production | MERGED | `crm/src/server/auth/open-mode.ts:9-13` (NODE_ENV != production and DEV_PERSONA_SWITCHING); `env.ts:75` forces false in production. @49019b93 | FACT |
| A3 | Live portal runs the open build | DEPLOYED (old) | HTTP 200 on `/admin` 2026-11-08 ~22:35Z; memory records live = `350bf67`; main commit `49019b93` is later | FACT (status), INFERENCE (that 200 is the admin page, not a login page) |
| A4 | Portal access protection VERIFIED in production | not verified | Needs deploy of main plus an anonymous probe returning 401/403. Cloudflare Access is the alternative; neither observed | UNKNOWN |
| A5 | Tenant isolation (RLS) | MERGED, TESTED | `crm/src/server/tenancy/withTenant.ts:10`; `crm/tests/integration/isolation.test.ts`; 37 RLS statements in `crm/drizzle/*.sql`; covered by CI `test:integration` on main 11-05 | FACT (existence, CI green), INFERENCE (suite coverage not re-read line by line) |
| A6 | Test inventory on main | MERGED | 52 unit, 84 integration, 17 e2e files under `crm/tests/` @49019b93 | FACT |
| B1 | Lead intake endpoint (signed per tenant) | MERGED, TESTED | `crm/src/app/api/hooks/leads/[tenantKey]/route.ts` -> `server/leads` with `signature.ts` | FACT |
| B2 | Outbound Alex call from `lead.created` with gates and retry | MERGED, TESTED | `crm/src/server/calls/outbound.ts:1-80` (event subscription, call row before provider call, kill switch, call window, 24h expiry), `outbound/gate.ts:89` kill switch. Adapters: `adapters/voice/elevenlabs.ts`, `retell.ts`, `fake.ts` | FACT |
| B3 | Portal outbound is OFF by default; no live provider path proven | DEPLOYED? | `deploy/env.example:17-20` OUTBOUND_ENABLED=false, ELEVENLABS_LIVE_ENABLED=false; `deploy/prod/compose.yml:24-25`. Live env values not read | UNKNOWN (live values) |
| B4 | Alex lead-to-booking verified end to end on live | not verified | Only recorded real run: 2026-10-15 test lead, booked, via old n8n+Retell workflow (`docs/progress.md` Done section, self-reported). No n8n Alex workflow active on 2026-11-08 (n8n list: only `WxIh0Hw4lQodY1Xa` contact form active; all Alex workflows `active:false`) | FACT (n8n flags), UNKNOWN (current end to end) |
| B5 | DEV lead-to-booking chain (synthetic) | BRANCH | `dev/codex-setup` PROGRESS-HISTORY: step 3 ticked, DEV deploy output `c34b11aa` supplied from Mac, "provider requests 0"; blocker note: no booking tools or calendar reservation verified | FACT (it says so), INFERENCE (claims unverified by me), no CI |
| C1 | Scheduling: portal appointments + availability | MERGED, TESTED | `crm/src/server/appointments/{service,availability}.ts`, `api/appointments/{availability,book}`; has `externalEventId` field. **No Cal.com code in `crm/src`** (grep found none) | FACT |
| C2 | Alex books via Cal.com tools on the ElevenLabs agent | DOC | `providers/elevenlabs/snapshots/2026-10-19-blitz/tool_*.json` reference cal.com; agent lives in ElevenLabs, not in repo; nothing connects Cal.com bookings into portal appointments | FACT (files), UNKNOWN (live agent now) |
| D1 | Follow-up engine / sequences | MERGED (partial) | `crm/src/server/outbound/sequences.ts` `enrollInSequence` returns `not_available` when no enabled automation; automations: `after-hours`, `missed-call-textback`, `reactivation`, `worker` in `server/automations/` | FACT |
| D2 | Follow-up n8n workflows | BRANCH / DEV | DEV n8n inactive: `DEV - missed-call`, `reminder`, `owner-alert`, `error-alert`, `sys-sandbox-dispatch`; repo `n8n/workflows/dev/`. Cal.com SMS workflow `3RdmNRxd17POGzlB` inactive | FACT |
| D3 | Texts to leads | DOC | A2P campaign verified 10-28 (memory, not independently checked); no SMS path activated | UNKNOWN |
| E1 | CRM core (contacts, companies, deals, kanban, tasks, notes, custom fields, bulk, import/export, search) | MERGED, TESTED | directories under `crm/src/server/*`; PRs #95-#118 closed with content in #121 `Merge work`; CI green on main | FACT (presence), INFERENCE (feature acceptance per F-id not re-read) |
| E2 | One unified CRM deliverable (no Lite/Full) | DOC conflict | Code and docs still model Lite/Full tiers (`BUILD_PLAN` M8a-07 plan/tier fields, M2-04 "CRM Full"); decision 2026-11-08 says one CRM. No code removal | FACT; needs doc relabel |
| E3 | Contact merge honors consent decision | MERGED but divergent | see Headline 4; PR #113 holds the decided behavior, base `claude/project-thread-ycssfs` | FACT |
| F1 | Build plan 136 of 188 done | DOC | `docs/BUILD_PLAN.md` status column: 136 done, 46 todo, 6 blocked, 1 "done (PR pending, 2026-11-02)" (189 status tokens vs 188 `| M..` rows; difference unexplained). Statuses are claims, not acceptance | FACT (counts), claim not proof |
| F2 | PR stack #45-#119 "closed" unmerged | MERGED via aggregate | #45, #72 merged directly; #121/#122/#123 "Merge work" carried the rest; all other stacked PRs closed unmerged by design | FACT |
| G1 | Contact-form workflow active | DEPLOYED | n8n `WxIh0Hw4lQodY1Xa` `active:true`, 2026-11-08. Never submitted end to end | FACT; function UNKNOWN |
| G2 | Website live from non-main branch | DEPLOYED | memory 11-05; `feat/positioning-remodelers` head `be91ac49`; not on main | INFERENCE for current deploy |
| H1 | Lead pipeline tooling | BRANCH | #134 head `df0f76bf` and #36 head `5efc1a82`: `tools/lead_pipeline.py`, tests, runbook byte-identical (diff of the three files across the two branches = 0 lines); neither on main; no CI | FACT |
| H2 | Deploy tooling for portal | MERGED | `crm/deploy/portal-new/*` (PR #129), `deploy/prod/*` | FACT |
| I1 | Agency workspace (M16, M17) | MERGED | #123 `Merge work: agency workspace (M16, M17-01)`; CI green 11-05 | FACT |
| I2 | Agency steps 7-12 on DEV | BRANCH | `dev/codex-setup` records local suites 527 unit PASS, agency checks 13 PASS/2 manual SKIP, DEV deploy confirmed by Mac output; no CI | FACT (self-report) |
| J1 | Stripe invoicing | DOC/BRANCH | Stub-mode billing drafts on `dev/codex-setup`; no live Stripe; connector sign-in expired | UNKNOWN live |
| K1 | Systems-build sandbox | BRANCH | `claude/project-thread-kj2v2h` 4f0402c5 (policy engine, sink adapter, DEV n8n); n8n `MOqT97N0ItVyKIno` inactive | FACT |

## 3. Branch and PR inventory

Open PRs (9): #137 docs status (head `claude/project-thread-rt9a7y`), #136 brand revamp (`feat/brand-revamp`), #134 lead pipeline, #113 M1-08 merge contacts, #39, #38, #37 (stacked site PRs), #36 lead pipeline (old), #34 Astro rebuild (draft).

Branches ahead of main with unmerged work and no open PR: `dev/codex-setup` (99), `feat/positioning-remodelers` (128), `claude/project-thread-x5righ` (146, site), `claude/project-thread-qptdya` (133, site), `feat/interactive-contact-form` (108), `claude/project-thread-kj2v2h` (2), plus older provider/feature branches. 170 branches total; most are stacked milestone branches already folded into main by #121-#123.

## 4. Release and security blockers (independent of any percentage)

1. Live portal open (A3/A4). 2. No deployed, tested Alex lead-to-booking path (B3/B4). 3. Counsel answer on consent decisions and TCPA emergency opt-out (docs/progress.md task 1.4). 4. Contact merge diverges from decided consent rule (E3). 5. Website TODO boxes and guarantee wording (not code). 6. No live Stripe flow (J1). 7. dev/codex-setup and site branches are unmerged, so main understates and the site cannot be rebuilt from main.

## 5. Unknowns to resolve (owner: coordinator or Abdullah)

Live portal env flags; whether the 11-05 auth work was ever deployed (live says no); ElevenLabs agent current config; Cal.com live event types; GitHub Projects boards; Stripe; Twilio SMS wiring; whether `dev.kyneticai.com` is current with `dev/codex-setup`.
