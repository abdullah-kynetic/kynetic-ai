# Plan 1: what is left, and the most effective way to do it

> **HISTORICAL — planning snapshot, not current instructions.** The active completion checklist is [COMPLETION-PLAN.md](../codex/COMPLETION-PLAN.md). Requirements and unresolved decisions are carried forward there. Old live-agent IDs, prices, dates, workflow activation or deployment instructions do not grant permission; all current safety and action-specific approval gates remain.


Source: Twenty tasks not DONE, read 2026-10-22 (read-only; 51 tasks). Task statuses can lag reality; where the repo disagrees I say so. "Live change" means it needs Abdullah's exact yes. Order follows the goal: clients 1-2 signed, everything repeatable automated.

## 0. Flags before anything else
- Dialing was due to start Tue Oct 20 and the task is still TODO, and **7.1 Launch gate check** is TODO. Either the gate was passed without ticking it or dialing is waiting. Twenty and `docs/progress.md` should say which.
- 1.4 counsel sign-off and 1.3 A2P are external lead-time items; the counsel email draft already exists (`docs/counsel-email.md`).
- Open dependency in 3.6: the post-call webhook has no auth and its path is committed in the repo JSON (see AUDIT.md #2).

## 1. Gate to calling (do first)
| Task | What is needed | Best way |
|---|---|---|
| 3.5 Outbound callback (IN_PROGRESS) | Retry path and duplicate check untested; confirm caller ID is not Nora's; Retell KYC | One scripted test with 2-3 test leads to your own phone, using the existing workflow; I can write the test checklist. Live: placing calls |
| 3.6 Compliance | Webhook auth, SMS opt-out, Contact relation, consent wording | Webhook auth is one header-auth credential on the webhook plus the same header in Retell's webhook settings (live: n8n + Retell, exact change needs your yes). Consent wording waits on counsel |
| 1.4 TCPA / counsel | Counsel sign-off on emergency opt-out gap | Send the existing draft; nothing to build |
| 1.3 A2P 10DLC | Registration for the demo number | Manual in Twilio; voice-first means it does not block calling (D-004) |
| 7.1 Launch gate | Checklist | Write the gate as a checklist in `docs/` from the four rows above; tick from evidence |

## 2. Sell and close (draftable now, no live change)
| Task | Best way |
|---|---|
| 4.1 / 4.2 Opener, demo script, objections, voicemail, Google Voice | Draft in repo for approval; calculator as a small static page or Twenty note (no Google Sheets) |
| 4.3 Unit economics | CSV/markdown model from real costs (Retell minutes, Twilio, n8n, VPS) vs $4,675 / $8,500 |
| 4.4 Guarantee terms | Decision for you and Quentin; I can lay out 2-3 options with the cost of each |
| 4.5 Proposal template | One page, drafted for your approval, never sent |
| 4.6 Stripe 3 milestone invoices | Live (Stripe). Most effective: n8n workflow triggered when the Twenty opportunity moves to CLOSED_WON that creates invoice 1 (50%) and schedules/creates 2 and 3 by milestone. Build inactive, test in Stripe test mode |
| 4.7 / 4.8 Agreement + attorney | Draft the single-offer agreement for Quentin's lawyer contacts; attorney review is external |

## 3. Onboard cleanly (the automation backbone)
| Task | Best way |
|---|---|
| 5.1 Intake form + checklist | n8n form creating `client_accounts` plus checklist tasks cloned from a Twenty template |
| 5.2 Onboarding automation | One n8n workflow from CLOSED_WON: agreement send, Stripe invoice 1, welcome message, Cal.com kickoff. Reuse 4.6 |
| 3.7 [CLIENT] bracket template + Add a Client guide | Parameterize the Alex build (`PROMPT.md`, `agent.config.json`, workflow Set nodes) using the `brand-profile` skills; the two hard-coded literals in the workflow (AUDIT.md #6) become variables |
| 5.3 / 5.4 Voice-first process, day-of-close SOP | Docs; draft after 5.2 so it describes real steps |
| 5.5 Portal wired to real data | Portal is live but nothing in the repo or n8n backup posts to `/api/ingest/results` (AUDIT.md #5). Build the daily n8n push from Twenty/Retell counts, one per-client key. Portal must clear KI-006/KI-008 before real data |
| 5.6 / 5.7 / 5.8 Weekly summary + alerts, monthly report, referral ask | Scheduled n8n workflows reading Twenty; start with the weekly summary since it doubles as error alerting |
| 6.1 Dry run with Quentin as fake client | Run after 5.1-5.2, timing each step; this is the real test of "cleanly onboard" |

## 4. Dated items
Oct 28 checkpoint (about 500 dials, 10 booked); Dec 1 last client signed; follow-up drafts for "call me back / send info" (manual, no cold SMS). Quentin confirmation on the meaning of "completion" and who dials was due Oct 19 and is still TODO.

## 5. Parallel clusters (own map clusters)
- **leadsourcing** (Twenty 2.1-2.5): list quality, then load to Twenty with sources, then automate the refill loop. Hard rules: public sources only, never guess an owner or phone. Note 2.5 says "Google Sheet" in the task title; project rule is no Google Sheets, so the loop should write straight to Twenty or the repo.
- **bakeoff** (3.9): does not block calling. Wiring the 11Labs workflow is gated on a winner; its agent and phone ids were still placeholders when read.

## 6. Plan 2 upsell demos (build on the back end, pitch on outbound calls)
Twenty has these as `[P2] LATER UPSELL`. Order by least new work, since the repo's n8n archive already holds working starts:
1. **Emily inbound receptionist** (3.1-3.4): nearly built; needs webhook repoint, Notion→Twenty swap (needs approval), publish, 3 test paths. Quickest demo. Do not touch Nora.
2. **System 1, reputation**: review request/response flow and GBP posts. Start from `Kynetic — Review Request + Response + Referral Chain` in `n8n/workflows/archive/`.
3. **System 3, lead recovery**: reactivation sender + reply handler, nurture sequence. Start from the `Kynetic — Reactivation Sender` and `Reply Handler` workflows in the archive.
4. **System 2 phase B**: chat widget, quoting, insurance claim documentation. Newest, least started; last.
Each demo should be built inactive on the Kynetic Restoration (Demo) skin or a copy, never by editing that record, then extracted into a [CLIENT] template like Plan 1.
