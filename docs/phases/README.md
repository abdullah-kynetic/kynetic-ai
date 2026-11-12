# Phases: the build order to a finished portal

Source: the Nov 12, 2026 audit and build plan (Claude doc "Portal audit and build plan (Nov 12)"), reordered by Abdullah the same day: automations, n8n and the AI layer come last. This folder is the repo copy a cold session reads.

## How to run a phase

Abdullah says "do phase N". The session then:

1. Reads `PROTOCOL.md` (the loop and the stop rules) and `phase-N.md` (scope and acceptance checks).
2. Works on one branch per phase, in small commits, following the loop.
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
