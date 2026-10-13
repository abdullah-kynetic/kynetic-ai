# Plan 1 walkthrough: top to bottom (Oct 8, 2026)

Plain-language map of everything between today and the first signed client. Mirrors the Twenty note "PLAN 1 WALKTHROUGH: top to bottom" and the 33 [P1] tasks. If this disagrees with Twenty, Twenty wins.

Plan 1 = the outbound speed-to-lead agent only, sold to roofing owners already running Meta ads. Price is D-017 (Quentin signed off): the first 3 clients pay $4,675 and clients 4 and up pay $8,500, billed as three Stripe invoices at 50/25/25. That replaces D-001. Gate to Plan 2 is 5 paying clients (D-013). D-003: build everything first, switch outreach on once.

Status of the 33 [P1] tasks today: 2 done, 3 in progress, 28 not started.

## The stages

| # | Stage | Tasks | Status | What is left |
|---|---|---|---|---|
| 0 | Foundations | 1.1 Cal key, 1.2 voice | DONE | Nothing. |
| 1 | Build the product (demo agent Alex + n8n workflow) | 3.5 | IN PROGRESS | Abdullah: check Retell identity verification, run `create-outbound --apply`, create the n8n credential. Then: fill 2 placeholders, web-call test, one test submission, phone test last. n8n `m2YJwZ1l8DTzyEkw` is 27 nodes (calling-hours gate and a fallback normalize step), inactive and untested. The Retell agent is not created yet. |
| 2 | Legal minimum | 1.4 counsel, 3.6 compliance, 4.7 agreement, 4.8 attorney review, 1.3 A2P | 1.4 IN PROGRESS, rest not started | Counsel email is drafted, not answered. 3.6: opt-out handling, calling hours, webhook auth, final consent wording. 1.3 A2P only matters for SMS (voice goes first, D-004). Counsel has outside lead time, so this is the long pole. |
| 3 | Find the owners | 2.1 to 2.5 | not started | Ad Library count, owner pass on the 14 Dallas roofing businesses, load owner-gated rows into Twenty, then automate the refill. |
| 4 | Sales kit | 4.1 opener, 4.2 scripts, 4.3 unit economics, 4.4 guarantee, 4.5 proposal, 4.6 Stripe link, prospect follow-up, standard pricing | 4.1 IN PROGRESS, pricing decided, rest not started | Standard pricing is D-017. Still open: opener and revenue calculator, demo script and objections, real cost per client, guarantee terms, one-page proposal, the three Stripe invoices. |
| 5 | Onboarding ready | 3.7 template, 5.1 to 5.4 | not started | Turn the demo into a copy-per-client template, intake checklist, auto-sent agreement + Stripe + kickoff booking, day-of-close activation SOP. |
| 6 | Dry run and launch gate | 6.1, 7.1 | not started | Quentin plays a fake client and every step is timed; then the launch gate check before any dialing. |
| 7 | Outreach | Phase 8 | not started | 75 manual owner dials a day starting Oct 15 (Q4 plan). No AI cold calls, no cold SMS (D-007). |
| 8 | First client live | 5.3 | not started | Setup fee paid, voice live day 1, SMS when the client's A2P approves. |
| 9 | Keep clients, reach 5 | 5.5 to 5.8 | not started | Portal, weekly summary and alerts, monthly report, referral ask and 30-day check-in. At 5 paying clients, decide on Plan 2. |

## Honest read

The product (stage 1) is the closest to done: a few small jobs for Abdullah away from a first test. The first signature is several stages away, and the stages that take longest are not the build: counsel (stage 2), the owner list (stage 3) and the sales kit (stage 4). Stages 2, 3 and 4 do not depend on each other and can run in parallel with stage 1.

## Question for Abdullah (not decided)

Do 5.5 to 5.8 (portal, weekly summary, monthly report, referral ask) have to exist before outreach starts, or can they be built after the first client signs? They are listed under Plan 1 but they do not look like blockers for a first sale. D-003 stays as decided; this only asks which tasks the launch gate (7.1) actually checks.

## Where we are today

Stage 1, partly done. Stages 2 to 9 not started except 1.4 and 4.1.
