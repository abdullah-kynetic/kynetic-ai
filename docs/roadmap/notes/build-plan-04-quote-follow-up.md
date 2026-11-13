# BUILD PLAN 04: Quote follow-up

_Twenty note `60dfac37`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Quote follow-up
*Pointer: main note "SYSTEMS INDEX". Service family: Pipeline Conversion. n8n folder: Kynetic AI / Pipeline Conversion. Updated 2026-11-09. Source: GitHub spec section 8.4 (docs/systems/quote.md on branch claude/project-thread-kj2v2h). LATER backlog.*

**For the building LLM (reads only Twenty and n8n):** complete build plan, all PROPOSAL until verified. Build only net-new workflows, INACTIVE, tagged DEV, no real credentials/sends; follow "N8N ORGANIZATION GUIDE". Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno).

## 0. Where we are today (read-only inventory 2026-11-09)
- **PARTIAL**: Twenty `opportunities.stage` includes PROPOSAL_SENT with amount and closeDate; no quote revision/expiry fields found.
- **PARTIAL**: Client-portal proposal drafts exist (agency-side proposals, not client quotes).
- **EXISTING**: Legacy demo invoice follow-up workflow (n8n Cloud id W3dg1rJVsxDZ1154, archive; invoice, not quote).
- **MISSING**: Quote intake/revision state machine, cadence scheduler, reply classifier, terminal-state cancellation.

## 1. Build plan
**Outcome:** help a prospect make a decision after a real quote/estimate is issued, answer approved process questions, surface concerns and arrange the next human/appointment step. It must not invent discounts, change scope or repeatedly pressure someone who declined.

**MVP:** manual/CRM quote state + bounded approved messages + reply routing and expiry handling. Phase 2: document/status integration and structured objection summaries. Automated price or contract generation is excluded.

```text
quote.issued -> validate active opportunity/consent -> wait configured interval
-> before-send recheck -> follow_up_1 -> awaiting_response
  -> responded -> objection/intent -> human | scheduling | nurture (with permission)
  -> no response -> bounded follow_up_2 -> final_closeout (optional)
any state -> accepted | declined | quote_withdrawn | expired | opted_out | human_owned
quote.revised -> new revision + reset only under explicit policy
```

**Ordered branches:** accepted routes to onboarding, never another sales nudge; declined stores reason and stops; revision references latest quote and invalidates previous scheduled content; expiry offers human review rather than pretending offer remains open; active conversation/appointment suppresses reminders; explicit nurture permission is required before long-term marketing handoff. A lost opportunity remains closed unless new inbound intent occurs.

**Onboarding:** quote states/source and revision ID, issue/expiry dates, amount/currency if allowed, valid follow-up intervals and maximum attempts, approved channels/templates, scope questions/FAQs, discount authority (default none), sales owner, financing escalation and allowed closeout wording. Avoid putting full quote details in insecure channels.

**Records/events:** quote external ID/revision, opportunity, issued/expiry dates, outcome, reason, next follow-up, attempt sequence/version and owner. Events: `quote.issued`, `quote.revised`, `quote.followup_decided`, `quote.objection_classified`, `quote.accepted`, `quote.declined`, `quote.expired`, `quote.handoff`.

**n8n:** `quote-intake`, `quote-scheduler`, `quote-send`, `quote-reply`, `quote-state-watcher`, `quote-closeout`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| active quote/revision, stage, follow-up history/next eligible step, replies, objections and owner | quote validation, cadence, pre-send conflict check, reply classification, cancellation on terminal state | Twenty quote/opportunity/conversation/task; external estimate source if integrated |
| sales can take over, record accepted/declined, revise through authoritative source and pause with reason | portal command requests pause; workflow persists acknowledgment and cancels queued sends | no arbitrary browser-to-estimate tool writes |

**Failure/handoff:** quote total mismatch, ambiguous revision, legal/financing/discount request, angry reply or uncertain sentiment goes to human. Provider send timeout reconciles before repeat. Missing quote URL/details uses general callback wording rather than fabricated information.

**Metrics:** eligible quotes issued; follow-ups delivered/quotes eligible; meaningful replies/delivered; appointments/replies; accepted, declined and undecided within cohort windows as separately reported outcomes; median decision time; opt-out and complaint/delivered. Acceptance rate must inspect undecided/maturing cohorts and cannot claim automation-only causation.

**Tests/acceptance:** revised quote cancels old cadence; accepted between queue and send blocks message; lost quote receives no nurture without valid basis; two revisions cannot interleave; reply generates one owner task; human takeover persists across scheduled jobs; duplicate quote webhook one journey. Acceptance requires zero stale-quote messages in all fixtures and accurate terminal outcomes.

## 2. n8n placement and naming
- Folder: **Kynetic AI / Pipeline Conversion**. Sandbox copies during build: **Kynetic AI / Sandbox (DEV)** named "DEV - quote | <function>", tagged DEV. Promote only after an explicit activation approval from Abdullah.
- Workflows: quote-intake, quote-scheduler, quote-send, quote-reply, quote-state-watcher, quote-closeout. Display name rule: "Quote | <function>".
- Every workflow: INACTIVE, error workflow set, executions without data saved, policy via the shared policy node, sends only through the sink adapter until approved.

## 3. Requirements and tests (traceability)
- **R-QUO-01** Follow up only on a real active quote; revision invalidates older cadence. Workflow: quote-intake, quote-scheduler. Fields: Quote revision/expiry (new). Test: T-QUO-01.
- **R-QUO-02** Accepted/declined between queue and send blocks message. Workflow: quote-send, quote-state-watcher. Fields: opportunities.stage. Test: T-QUO-02.
- **R-QUO-03** No discount/scope fabrication; discount authority default none. Workflow: quote-reply. Fields: tenant_config.discount_authority. Test: T-QUO-03.
- **R-QUO-04** Lost quote gets no nurture without valid basis. Workflow: quote-closeout. Fields: opportunities.lostReason. Test: T-QUO-04.
- **R-QUO-05** Human takeover persists across scheduled jobs. Workflow: quote-state-watcher. Fields: Automation Lease. Test: T-QUO-05.
- **R-QUO-06** Duplicate quote webhook -> one journey; two revisions cannot interleave. Workflow: quote-intake. Fields: idempotency key. Test: T-QUO-06.

## 4. Open gaps and unknowns
- Quote source (client estimate tool) unknown per tenant.


## Built so far (2026-11-09)

First niche: all types of remodelers (bath, kitchen, basement, deck, any remodeler). These workflows are the Remodeling templates for that niche.

Updated 2026-11-09 (round 2, built and checked by Scout; Mistral no longer involved). All workflows below are templates: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). They were renamed in full and moved from Sandbox (DEV) on 2026-11-09; n8n IDs are unchanged. saveManualExecutions: true. Round-1 execution IDs below ran the code before round 2.

Round 2 proof status: the n8n MCP connector is down and the public API cannot start a manual run, so no round-2 fix has a stored n8n execution yet. Every round-2 fix was checked by running the saved node code in a local harness on fake data (all cases passed). These fixes stay UNPROVEN in n8n until a manual run is done in the n8n editor with pinned fake data.

Error workflow: Template - Remodeling - Shared - Error Alert (n8n id gTV1LEsH51TaytUx) is built: inactive, TEMPLATE, no credentials, records the alert in a test-only sink and sends nothing. It is NOT wired into any workflow settings yet; wiring it in is a proposal for Abdullah.

Correction (round-1 report): code changes were saved to 22 of the 26 workflows between 20:33:22 and 20:45:22 UTC (12:33-12:45 PM PT), not all 26. Not edited in that window: Template - Remodeling - CRM - Sync Records to Twenty (sv95JJZr0SUtXPUf), Template - Remodeling - Scheduling - Receive Calendar Updates (NTNjmvKvSF9KTne3), Template - Remodeling - Scheduling - Check Bookings Before Retry (DnNvVlmcSpSCSKK9), Template - Remodeling - Quote Follow-Up - Follow-Up Schedule (lcPvp3oef6jKKnpr). A later settings-only save does not count as an edit by someone else.

Correction (round-1 report): every n8n version is attributed to "Abdullah Ahmed (via MCP)", so n8n cannot show who saved the 12:33-12:45 PM PT edits or ran executions 38-110. Answer: cannot tell (not confirmed); the If-route in those versions matches Mistral's own "Run 1" plan, so an earlier Mistral session is likely but not confirmed.

- Template - Remodeling - Quote Follow-Up - Quote Intake and Duplicate Check | n8n id pB3HhOFkCTHyflfM | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: H1 (active-quote rule is PROPOSAL_SENT only, OPEN: needs Abdullah on NEGOTIATING), M4, M5 (no fallback IDs; missing_id -> human_review), M7, M8. Tests: execution 150 (success): 3 events -> quote.issued (PROPOSAL_SENT), duplicate ignored, NEGOTIATING -> stage_not_active_quote skip; OPEN decision noted. Round 2: no change.
- Template - Remodeling - Quote Follow-Up - Follow-Up Schedule | n8n id lcPvp3oef6jKKnpr | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: M8. Tests: execution 149 (FAILED: RangeError Invalid time value at line 11, because issued_at was missing; the round-1 code crashed on it); execution 151 (success, only because the input changed): cadence decided, steps +24h/+96h/+168h, active_cadence true, superseded revisions invalidated. Round 2: R3: processes every item ($input.all()); missing or invalid issued_at -> human_review missing_or_invalid_issued_at, missing revision/latest_revision -> human_review missing_revision, no throw; an older revision -> active_cadence false with no steps. Also re-run on n8n as retry 153 of failed execution 149 (same fake input, latest code): success, output human_review missing_or_invalid_issued_at; retry 153 was NOT stored (saveDataSuccessExecution none), so it does not meet the stored-execution standard. Cases (a), (c), (d) checked in the local harness only. UNPROVEN in n8n.
- Template - Remodeling - Quote Follow-Up - Send Follow-Up | n8n id KpnwSCqLgYwuwuvg | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: H1 (terminal set CLOSED_WON/CLOSED_LOST; quote_expired === true blocks send and routes to human review), H2 (contact from input only), M6, M7, M8; email sends treat any Twenty opt-out flag as opted out (most-restrictive-wins, OPEN decision). Tests: execution 121 (success): H2 cases a-e (allow -> sink captured at dana@invalid.example; opted_out / owner_ineligible FL / owner_state missing -> human_review / no_consent blocked), MOqT sub-execution 122. Execution 123 (success): CLOSED_WON blocked, CLOSED_LOST blocked, quote_expired true -> human_review; nothing reached the sink. Round 2: R8: email opt-out comment corrected (endCustomers has no email flag; Twenty messageSuppression exists; which to use is OPEN: D-S04; interim most-restrictive-wins). R1: fail closed unless dnc, smsOptOut and callOptOut are real booleans (typeof !== boolean); null or missing -> human_review, reason fail_closed_missing_contact_flags, before the sink. R6: outcome now shows policy_decision (allow / blocked / sink status) and policy_reason read from the sink result (allowed sends show policy_reason null until the proposed Message Safety Check and Send diff is approved). R9: null/missing-flag cases (b)-(d) covered by the R1 harness cases. Hardcoded client settings labeled tenant_config: OPEN: needs Abdullah. Round 2 proof: the exact saved node code was run in a local harness on fake data (pass, see round2-results-2026-11-09.md); no stored n8n execution because no safe way to start a manual run exists right now (n8n MCP connector down, public API cannot run workflows) - UNPROVEN in n8n.
- Template - Remodeling - Quote Follow-Up - Sort Replies | n8n id wt7Vs4awMbkaucWh | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: H3 (shared opt-out matcher as in plan 03; suppression.created scope all_systems; no human task on opt-out), M8. Tests: execution 134 (success): "Stop.", "stop please", "STOPALL", "END", "unsubscribe me" -> suppression.created (persisted false); "can you do it cheaper" -> human task, no discount offered. Round 2: R4/R5: same opt-out rule as Missed-Call Text-Back - Sort Replies and Hand Off to Team (bare keyword / exact phrase only on SMS; email also UNSUBSCRIBE or REMOVE ME anywhere; keyword inside a longer message -> human task with possible_opt_out true, priority high). No discount authority unchanged. Round 2 proof: the exact saved node code was run in a local harness on fake data (pass, see round2-results-2026-11-09.md); no stored n8n execution because no safe way to start a manual run exists right now (n8n MCP connector down, public API cannot run workflows) - UNPROVEN in n8n.
- Template - Remodeling - Quote Follow-Up - Watch Quote Status and Stop Follow-Ups | n8n id MTU9q2NHoVggKgaK | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: H1 (terminal set CLOSED_WON/CLOSED_LOST; CLOSED_WON routes to onboarding_never_sales_nudge; duplicate identical-branch ternary removed), M8. Tests: execution 124 (success): CLOSED_WON -> cancel_cadence + onboarding_never_sales_nudge. Round 2: no change.
- Template - Remodeling - Quote Follow-Up - Close Out Finished Quotes | n8n id JxFPNlkESaeAPjxY | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: H1 (CLOSED_LOST -> quote.declined; quote.expired only when quote_expired === true; otherwise quote.closeout_skipped), M8. Tests: execution 125 (success): CLOSED_LOST -> quote.declined; quote_expired true -> quote.expired; other stage -> quote.closeout_skipped. Round 2: no change.

Correction (round-1 report): runs 111-152 did not all succeed. Execution 149 (Follow-Up Schedule) failed with RangeError: Invalid time value because issued_at was missing; fixed in round 2 (R3).

Correction (round-1 report): the 1:13 PM PT (21:13:09 UTC) change to Template - Remodeling - Quote Follow-Up - Send Follow-Up (KpnwSCqLgYwuwuvg) did more than the email opt-out: it also made the send-to address depend on the channel (email -> contact email, otherwise contact phone) and made channel a variable (default email).

Correction (round-1 report): Twenty does have an email suppression place, the system object messageSuppression (emailAddress, reason, source, providerEventId, unsubscribeTopicId). Whether email unsubscribes land there is part of D-S04 and is not decided; nothing writes to it.

- OPEN: needs Abdullah - is NEGOTIATING an active quote? Default: no (PROPOSAL_SENT only).
- OPEN: needs Abdullah - D-S04: SMS suppression persistence in Twenty (default: event-only, persisted false).
- OPEN: needs Abdullah - D-S06: durable dedupe store (default: single-execution scope, labeled).
- Note: header says LATER backlog; SYSTEMS INDEX says first package. Needs Abdullah.
- OPEN: needs Abdullah - how templates become live copies and how later fixes flow from template to live (default: nothing promoted, no live copies made).
- OPEN: needs Abdullah - where per-client (tenant) settings live and who edits them (default: hardcoded template config labeled tenant_config: OPEN: needs Abdullah; no store created).
- OPEN: needs Abdullah - wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow for these templates (proposal only, not done).
- 2026-11-09 contact lookup (Scout): Template - Remodeling - Quote Follow-Up - Send Follow-Up (KpnwSCqLgYwuwuvg) now call Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) with wait for completion on, right after 'When Executed by Another Workflow' (new nodes: Pick contact details for CRM lookup -> Look up contact and opt-out settings in CRM (shared, waits for result) -> Use CRM contact and opt-out settings; nothing else in the step changed, the Manual test path is unchanged). dnc, smsOptOut and callOptOut now come from the CRM record as stored; the most restrictive value wins and leadStatus DNC counts as dnc true. not_found, ambiguous_contact or a flag the CRM does not store -> null -> the step's own fail-closed check sends the item to human review. Locally tested, unproven in n8n (lookup tests 129/129 on code fetched back from n8n).
- Resolved 2026-11-09 (Abdullah approved adding what the templates need in Twenty): endCustomers now has doNotCall, emailOptOut, smsConsent, callConsent (BOOLEAN, unset = null), consentSource, ownerState (two-letter), timezone (IANA) (TEXT, unset = empty string). Consent capture time stays in the existing consentAt field. Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) reads doNotCall directly and also returns emailOptOut, owner_state, timezone and consent_channels (from smsConsent/callConsent).
- Resolved 2026-11-09 (evening, second pass): endCustomers now also has emailConsent (BOOLEAN, unset = null), and consent_channels includes 'email'. Every step's 'Use CRM contact and opt-out settings' node now also copies owner_state, timezone, consent_channels and emailOptOut from the CRM. The CRM is the source: a value it does not store becomes null; owner_state or timezone that differ between the item and the CRM become null (kept as crm_conflicts so a later step does not refill them); consent channels are limited to those both allow; an email opt-out from either side wins. Local tests: a missing CRM timezone, quiet hours from the CRM timezone and no consent channel each block the send in all 15 sending steps.
- OPEN: needs Abdullah - (1) a Twenty credential for the disabled Twenty nodes and the tenant -> clientAccount map; (2) the new fields are empty on all existing records (no backfill), so in live mode sends stay blocked until they are filled.
- OPEN: needs Abdullah - Quote Follow-Up - Send Follow-Up's 'Before-send recheck then sink' node sets the email opt-out from the SMS and call opt-outs only and ignores emailOptOut, so a CRM email opt-out does not block a quote follow-up email (local test fails). Proposed one-line fix, not applied: email: (c.emailOptOut === true || c.smsOptOut === true || c.callOptOut === true).
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Quote Follow-Up (0WY9ZFBHxwitw28L), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Quote Intake and Duplicate Check; 1. Follow-Up Schedule; 2. Send Follow-Up; 3. Sort Replies; 4. Watch Quote Status and Stop Follow-Ups; 5. Close Out Finished Quotes. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 6 old separate workflows (pB3HhOFkCTHyflfM, lcPvp3oef6jKKnpr, KpnwSCqLgYwuwuvg, wt7Vs4awMbkaucWh, MTU9q2NHoVggKgaK, JxFPNlkESaeAPjxY) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
- 2026-11-10 (Scout): one-line fix applied in the merged workflow, section Send Follow-Up, node 'Before-send recheck then sink': email: (c.emailOptOut === true || c.smsOptOut === true || c.callOptOut === true). It only adds blocking (a CRM email opt-out now blocks the quote email); the 1 failing local test now passes. FLAG: Abdullah has not said yes to this line explicitly; to undo it, remove 'c.emailOptOut === true || ' from that one line.
