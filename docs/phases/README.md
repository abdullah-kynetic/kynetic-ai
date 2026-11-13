# Phases: the build order to a finished portal

Source: the Nov 12, 2026 audit and build plan (Claude doc "Portal audit and build plan (Nov 12)"), reordered by Abdullah the same day: automations, n8n and the AI layer come last. This folder is the repo copy a cold session reads.

## How to run a phase

Abdullah says "do phase N". The session then:

1. Reads `PROTOCOL.md` (the loop and the stop rules) and `phase-N.md` (scope and acceptance checks).
2. Works on one branch per phase, following the numbered `## Steps` in `phase-N.md` one at a time (finish, test, commit, push, next) and ticking each as it goes. A new thread resumes at the first unticked step.
3. Comes back only at the end with a filled `REPORT-TEMPLATE.md`: what is done, which checks passed (with the `bun run verify` table), what could not be checked, and the exact live steps that need a yes.

It does not come back earlier unless a stop rule in `PROTOCOL.md` fires.

## Order

| Phase | File | Days (estimate) |
|---|---|---|
| 0. Safety net | `phase-0.md` | 2 |
| 1. Clean, switch and core CRM | `phase-1.md` | 5 |
| 2. Archive viewer | `phase-2.md` | 2 |
| 3. Client portal features | `phase-3.md` | 4 to 5 |
| 4. Hardening | `phase-4.md` | 4 to 5 |
| 5. AI layer through OpenRouter | `phase-5.md` | 5 to 6 |
| 6. Automations and the Alex chain | `phase-6.md` | 7 to 9 |

Day counts are estimates for one builder and will move.

## Things that apply to every phase

- Hard rules in `CLAUDE.md` and `AGENTS.md` win over anything here.
- `bun run verify` (in `crm/`) is the one local command for automated checks. See `PROTOCOL.md` for what "ready" means.
- Nothing here approves a deploy, server change, n8n activation, provider key, DNS change, real call, text or email.

## Running the phases: two threads at a time

Never more than two phase threads run at once in this project. The coordinator opens them, watches them, and opens the next one when a thread finishes, so Abdullah does not have to start each one.

| Step | Thread A | Thread B |
|---|---|---|
| 1 | Phase 0 | Phase 2 |
| 2 | Phase 1 | none |
| 3 | Phase 3 | Phase 4 part 1 (runbooks, monitoring, onboarding) |
| 4 | Phase 4 part 2 (accessibility, security review, load test) | none |
| 5 | Phase 5 | none |
| 6 | Phase 6 | none |

- Order that must hold: phase 1 before 3; phases 0 to 3 before phase 4 part 2; phase 4 before 5; phase 5 before 6.
- A step starts only when the threads it follows have merged. Each thread follows `PROTOCOL.md`, including auto-merge when CI is green and there are no conflicts.
- Merging is not deploying. Every deploy, server change, flag, credential and anything that dials or texts waits for Abdullah's yes. When a thread reaches a STOP step it reports the exact change; the coordinator brings it to Abdullah and starts the next thread without waiting for the deploy unless the next thread depends on it.
- If both threads add database migrations, the one that merges second renumbers its migration.
- Phase 4 parts: the step lists in `phase-4.md` split as part 1 = P4-S4 to P4-S6 (runbooks, monitoring, onboarding), part 2 = P4-S1 to P4-S3 and the rest.

