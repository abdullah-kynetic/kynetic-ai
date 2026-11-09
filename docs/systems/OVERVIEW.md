# Kynetic systems at a glance (one page)
Status as of 2026-11-09, from `docs/build-inventory.md`. Details per system: `docs/systems/<name>.md`.

| # | System | What it does | State today |
|---|---|---|---|
| 1 | Speed-to-lead Alex | Calls/texts new leads fast, qualifies, books | Partial: legacy n8n flow + portal gate; ElevenLabs dev flow inactive |
| 2 | Emily (inbound receptionist) | Answers inbound calls, takes messages, transfers | Legacy only; paused (Plan 2) |
| 3 | Missed-call text-back | Texts back after a genuinely missed call | Portal code + inactive DEV flow |
| 4 | Quote follow-up | Bounded follow-ups on real quotes | Mostly missing |
| 5 | Old-lead reactivation | Finite campaign to consented dormant leads | Legacy Notion flows, portal code |
| 6 | Long-term nurture | Permissioned, approved-content check-ins | Twenty campaign objects only |
| 7 | Reviews | Neutral review requests after completed work | Legacy chain; request job missing |
| 8 | Referrals | Voluntary referral invites and attribution | Missing |
| 9 | Maintenance reminders | Service/warranty reminders | Missing; scope to confirm |
| 10 | One CRM deliverable | Configurable pipeline in Twenty | Twenty mapped (47 objects) |
| 11 | Scheduling | One appointment truth across channels | Cal.com + portal availability; no locks |
| 12 | Online presence | Accurate listings, approval queue | Task-list model only |
| 13 | Ads tooling | Read-only reporting and proposals | Missing |
| - | Platform: standard portal, internal maintenance, custom AI / transformation | Shared portal contract, backups and alerts, scoped custom work | Contract and backups exist; rest scoped separately |

Built so far: shared policy engine + sink adapter (`templates/shared/`), inactive DEV workflow `MOqT97N0ItVyKIno`, 16 tests. Nothing is active or sending.
