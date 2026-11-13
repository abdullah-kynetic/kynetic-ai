# SCORECARD BASELINE v1 (frozen weights, 2026-11-08)

_Twenty note `603fe300`, created 2026-11-08, updated 2026-11-08. Exported 2026-11-12._

# SCORECARD BASELINE v1 (frozen 2026-11-08)

This is the ONLY editable list of acceptance checks. Weights are fixed before scoring and never edited; a scope change creates a v2 note. Roadmap: note **ROADMAP (CANONICAL)** (id 7bfdcb7e). Scores: note **SCORECARD: current status**.

**Rules.** Each step totals 100 points. A check is verified complete only with attributable evidence (commit, PR, CI run, deploy record, observed response, Twenty record id) dated. Missing evidence is UNKNOWN, not incomplete. Verified incomplete needs positive evidence the work is absent or failing. Unknown stays in the denominator. Subchecks give partial credit. For technical work the subchecks separate built, tested and deployed. Not based on file counts, lines, ticket counts or elapsed time.

**What the overall number means.** Steps 1 to 3 form one *readiness* index (can Kynetic sell and deliver): weight 15 / 35 / 50. Rationale: delivery is the largest build and the main risk, the sales foundation is mostly documents and one deploy, consolidation is small. Steps 4 and 5 are business outcomes and are reported separately (counters, not blended): signed clients out of 3, delivered clients with measured results. Completed software is not a signed client. Owner column: Abdullah build and delivery, Quentin sales (from standing brief); items marked (prop.) are proposals, not assignments.

## Step 1: Consolidate the plan (100)
| ID | Outcome and acceptance | Evidence required | Wt | Why | Depends | Owner | Next action |
|---|---|---|---|---|---|---|---|
| S1.1 | Canonical roadmap in Twenty maps all 59 tasks to the five steps; later work in a separate backlog | roadmap note read back | 25 | core deliverable | none | coordinator | done on write |
| S1.2 | Superseded planning marked and linked to canonical; nothing deleted | note and task edits read back, change journal | 20 | prevents competing plans | S1.1 | coordinator | batch edits |
| S1.3 | Weighted baseline stored versioned | this note | 20 | stops silent inflation | none | coordinator | done on write |
| S1.4 | GitHub execution tracking cross-linked to the Twenty roadmap, no duplicate editable acceptance list | GitHub PR or issue links the roadmap note id | 20 | one writer per area | GitHub thread | coordinator | link from repo docs |
| S1.5 | Evidence-update protocol written | roadmap note section | 15 | keeps it alive | S1.1 | coordinator | done on write |

## Step 2: Sales-ready foundation (100)
| ID | Outcome and acceptance | Evidence required | Wt | Why | Depends | Owner | Next action |
|---|---|---|---|---|---|---|---|
| S2.1 | Portal access protection. Subchecks: (a) auth build merged and tested 10; (b) deployed, unauthenticated GET /admin does not return 200 content 10 | (a) merge commit, CI; (b) dated curl plus deploy record | 20 | open admin is a release and security blocker | VPS deploy by Abdullah | Abdullah | deploy main via Kynetic VPS, invite Abdullah and Quentin |
| S2.2 | Outcome-focused website and offer requirements approved (D-023 terms, outcome copy, guarantee wording, /remodelers TODOs resolved) | written spec with Abdullah approval, live page matches | 10 | prospects see this first | none | Abdullah | resolve TODO boxes |
| S2.3 | Contact form works end to end (submission reaches n8n data table and Twenty, alert received) | test execution id and Twenty person id | 5 | lead capture | none | Abdullah | one test submission |
| S2.4 | One offer source: no live artifact quotes superseded pricing or niches, or each is flagged | scan of Twenty fields, proposal text, repo docs | 10 | wrong price to a prospect is costly | none | coordinator | list and fix stale text |
| S2.5 | Free AI audit process documented and repeatable (steps, inputs, sample output) | doc link | 10 | the offer front door | none | Abdullah (prop.) | write it |
| S2.6 | Pitch script: (a) cold-call opener, demo and objection script final 8; (b) rehearsed or approved by Abdullah and Quentin 7 | doc and approval record | 15 | cold calling is Step 4 | S2.4 | Quentin (prop.) | finalize 4.1 and 4.2 |
| S2.7 | Close: (a) proposal template on D-023 pricing 5; (b) invoice mechanics (Stripe milestones) defined 5; (c) agreement draft ready for counsel 5 | docs, Stripe config read-only | 15 | needed on first yes | S2.4 | Abdullah and Quentin (prop.) | rewrite 4.5, 4.6, 4.7 |
| S2.8 | Compliance gate: (a) counsel sign-off on TCPA emergency opt-out gap 8; (b) attorney review of MSA and SOW 7 | counsel written reply | 15 | external lead time, blocks go-live | counsel | Abdullah | counsel email draft exists in repo docs |

## Step 3: First delivery package (100)
| ID | Outcome and acceptance | Evidence required | Wt | Why | Depends | Owner | Next action |
|---|---|---|---|---|---|---|---|
| S3.1 | Alex live path on ElevenLabs. Subchecks: (a) paid plan, number and caller ID 6; (b) one Alex workflow active 6; (c) test call from own phone books a slot 6 | provider state, n8n active flag, call log | 18 | no live Alex today | Abdullah approvals | Abdullah | LAUNCH BLOCKER task |
| S3.2 | Lead-to-booking chain (form, Twenty, call within 60s, Cal.com, log). Subchecks: (a) built 5; (b) synthetic end-to-end test passes 5; (c) deployed and live 5 | workflow json, execution ids, deploy record | 15 | the product | S3.1 | Abdullah | Codex steps 3 to 6 |
| S3.3 | ONE unified CRM deliverable defined (scope, what the client sees, no Lite/Full, standard versus bespoke boundary) | scope doc | 8 | prevents scope drift | none | Abdullah and coordinator (prop.) | write scope |
| S3.4 | Unified CRM deliverable works for a client tenant. Subchecks: (a) implemented and tested 6; (b) deployed with a client tenant, auth on 6 | merge, CI, deploy record | 12 | clients get a place to see results | S2.1 | Abdullah | portal build |
| S3.5 | Scheduling: booking and reminders work for a client. (a) built and tested 4; (b) live verified 4 | tests, live execution | 8 | appointments are the outcome | S3.2 | Abdullah | |
| S3.6 | Essential follow-up (no-answer and missed-call follow-up, text after A2P wiring). (a) built and tested 4; (b) live verified 4 | tests, live execution | 8 | follow-up wins deals | S3.2, A2P | Abdullah | |
| S3.7 | Compliance gates before live: opt-out handler, webhook auth, consent wording, quiet hours. (a) implemented and tested 5; (b) deployed 5 | tests, deploy record | 10 | legal risk | none | Abdullah | task 3.6 |
| S3.8 | Reusable-template roadmap written (client bracket template, Add a Client guide, per-client config) | doc | 5 | scale to 25 | S3.1 | Abdullah | task 3.7 |
| S3.9 | Demo-client end-to-end gate: (a) written acceptance gate defined 3; (b) gate passed on the demo client with timings 13 | gate doc, run record | 16 | proves it is deliverable | S3.1 to S3.7 | Abdullah and Quentin | task 6.1 |

(S3 subchecks sum: 3.1=18, 3.2=15, 3.3=8, 3.4=12, 3.5=8, 3.6=8, 3.7=10, 3.8=5, 3.9=16 total 100.)

## Step 4: Cold-call remodelers, sign the first three (100, outcome counters)
S4.1 owner-gated remodeler call list ready and loaded in Twenty 15. S4.2 dialing started and logged in Twenty 15. S4.3 demos held 15. S4.4 proposals sent 10. S4.5 client 1 signed 15. S4.6 client 2 signed 15. S4.7 client 3 signed 15. Evidence: Twenty companies, call_logs, opportunities (stage CLOSED_WON), signed agreement. Other channels stay parked. Owner: Abdullah and Quentin (dialer field). Depends on Step 2 minimum (script, offer, pitch demo asset) not on Step 3 completion.

## Step 5: Deliver, measure, learn (100, outcome counters)
S5.1 client 1 live with booked appointments 20. S5.2 appointment and result reporting per client 20. S5.3 delivery effort tracked per client 15. S5.4 templates refined from delivery 15. S5.5 first case study 15. S5.6 expansion decision gate (channels, multi-location) 15. Evidence: client results, time logs, published case study.

## Version log
v1 2026-11-08: initial. Weights frozen.
