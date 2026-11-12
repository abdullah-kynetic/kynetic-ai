# BUILD PLAN 11: Scheduling

_Twenty note `25036c8b`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Scheduling
*Pointer: main note "SYSTEMS INDEX". Service family: Revenue Infrastructure. n8n folder: Kynetic AI / Revenue Infrastructure. Updated 2026-11-09. Source: GitHub spec section 8.11 (abdullah-kynetic/kynetic-ai, branch claude/project-thread-kj2v2h, docs/systems/scheduling.md).*

**For the building LLM (reads only Twenty and n8n):** this note is a complete build plan. Everything here is a PROPOSAL until verified against current vendor docs, Twenty metadata and n8n node behavior. Build only net-new workflows, INACTIVE, tagged DEV, with no real credentials/sends; follow "N8N ORGANIZATION GUIDE" for folders and names. Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, real outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse the built shared sandbox workflow "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno: policy decide + sink send) for all policy/dry-run logic.

## 0. Where we are today (read-only inventory 2026-11-09)
- **EXISTING**: Cal.com is calendar authority (free plan). Event types: Roof Inspection `7404470` (Retell), ElevenLabs test `7520336`, Emily Water Damage `7025524`.
- **EXISTING**: Portal availability/booking code and tests (automation-map B6 = partial); Cal.com sync mapping not confirmed.
- **EXISTING**: VPS workflow `3RdmNRxd17POGzlB` "Cal.com | Booking SMS (Twilio)" inactive (built inactive 2026-10-22).
- **MISSING**: Resource lock, ETag/hold, reconcile-by-external-id, revision history, concurrent-booking test.

## 1. Build plan
**Outcome:** offer valid windows, book/reschedule/cancel exactly once, synchronize calendar and Twenty, and give voice/text/human channels one appointment truth.

**MVP:** one fake tenant/resource/type and fake calendar adapter + controlled reminders. Phase 2: real client provider in approved sandbox, multi-staff. Travel/team routing is phased complexity.

```text
intent -> appointment type/resource -> fresh availability -> offer expiring windows
-> selection -> resource lock + revalidation -> provider confirm
-> confirmed -> reminders -> completed | no_show | cancelled | rescheduled
selection conflict -> alternatives
provider unknown -> reconcile_by_command_or_external_id -> confirm/retry/human
```

Always store full timestamp + IANA timezone. Voice can offer only backend-returned slots. Reschedule uses same appointment ID/revision. Cancellation ambiguity goes human/confirmation. Reminders cancel/reschedule with appointment changes. Detect provider echo without ignoring legitimate external edits.

**Onboarding:** provider/read-write calendars; included busy calendars; resource/team rules; appointment duration/buffer; service area/travel; hours/holidays/timezones; minimum notice/horizon; owner/round robin; cancellation/no-show policy; reminder cadence; conference/venue and external webhook semantics.

**Records/events:** external appointment ID/revision, person/opportunity, resource, start/end/zone, state, source and command history. `availability.offered`, `appointment.selected`, `appointment.confirmed`, `appointment.rescheduled`, `appointment.cancelled`, `appointment.completed`, `appointment.no_show`, `appointment.conflict`.

**n8n:** `schedule-intent`, `schedule-availability`, `schedule-book`, `schedule-event-ingest`, `schedule-reminders`, `schedule-reconcile`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| tenant appointment/resource view, booking source/state/revision, conflict and reminder result | availability, locks/idempotency, provider commands, event ingest, reminders and reconciliation | Twenty appointment projection/history; calendar authority externally |
| front desk/sales authorized reschedule/cancel with confirmation | backend revalidates slot/role; arbitrary provider payload rejected; no browser credential | customer self-service token only if separately built, scoped and expiring |

**Failure:** timeout reconciles before retry; permission revoked disables affected writes; resource unavailable releases lock; unknown external event review; no silent duplicate. No-show relies on staff/provider evidence not inference alone.

**Metrics:** intents; offers/intents; confirmations/offers; conflicts/attempts; provider sync lag; cancellations/no-shows among appointments due in matured period; booking source. Distinguish confirmation from completed appointment.

**Tests/acceptance:** two simultaneous same selections yield one confirmation; stale offers revalidate; timeout no duplicate; DST and leap day correct; reschedule one ID with history; cancellation stops reminders; Tenant A cannot access B calendar; all confirmation states reflect actual fake provider acknowledgment. Acceptance requires concurrency and reconciliation test evidence.

## 2. n8n placement and naming
- Folder: **Kynetic AI / Revenue Infrastructure**. Sandbox copies during build: **Kynetic AI / Sandbox (DEV)** named "DEV - scheduling | <function>" and tagged DEV. Promote (move + rename, drop DEV) only after an explicit activation approval from Abdullah.
- Workflow names: `schedule-intent`, `schedule-availability`, `schedule-book`, `schedule-event-ingest`, `schedule-reminders`, `schedule-reconcile`. Display name rule: "Scheduling | <function>".
- Every workflow: INACTIVE, error workflow set (see guide), executions without data saved, policy via the shared policy node, sends only through the sink adapter until approved.

## 3. Requirements and tests (traceability)
- **R-SCH-01** Offer only backend-returned slots; revalidate free/busy at confirm. Workflow: `schedule-availability`, `schedule-book`. Fields: Appointment (new): external id, revision, tz. Test: T-SCH-01 stale offer revalidates.
- **R-SCH-02** Two simultaneous same selections -> one confirmation. Workflow: `schedule-book`. Fields: resource lock. Test: T-SCH-02 concurrency.
- **R-SCH-03** Provider timeout reconciles before retry; no duplicate. Workflow: `schedule-reconcile`. Fields: command idempotency key. Test: T-SCH-03.
- **R-SCH-04** Reschedule keeps one appointment ID with history; cancel stops reminders. Workflow: `schedule-event-ingest`, `schedule-reminders`. Fields: revision. Test: T-SCH-04, T-SCH-05.
- **R-SCH-05** Full timestamp + IANA zone; DST/leap day correct. Workflow: all. Fields: start/end/timezone. Test: T-SCH-06.
- **R-SCH-06** `allow_external_write=false` rejects writes at the adapter. Workflow: CalendarAdapter. Fields: policy.allow_external_write. Test: T-SCH-07.
- **R-SCH-07** Tenant A cannot touch B calendar. Workflow: all. Fields: tenant_id. Test: T-SCH-08.

## 4. Open gaps and unknowns
- Cal.com free plan limits (webhooks, workflows) to verify; Cal.com ETag/hold support unverified.



## Built so far (2026-11-09)

First niche: all types of remodelers (bath, kitchen, basement, deck, any remodeler). These workflows are the Remodeling templates for that niche.

Updated 2026-11-09 (round 2, built and checked by Scout; Mistral no longer involved). All workflows below are templates: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). They were renamed in full and moved from Sandbox (DEV) on 2026-11-09; n8n IDs are unchanged. saveManualExecutions: true. Round-1 execution IDs below ran the code before round 2.

Round 2 proof status: the n8n MCP connector is down and the public API cannot start a manual run, so no round-2 fix has a stored n8n execution yet. Every round-2 fix was checked by running the saved node code in a local harness on fake data (all cases passed). These fixes stay UNPROVEN in n8n until a manual run is done in the n8n editor with pinned fake data.

Error workflow: Template - Remodeling - Shared - Error Alert (n8n id gTV1LEsH51TaytUx) is built: inactive, TEMPLATE, no credentials, records the alert in a test-only sink and sends nothing. It is NOT wired into any workflow settings yet; wiring it in is a proposal for Abdullah.

Correction (round-1 report): code changes were saved to 22 of the 26 workflows between 20:33:22 and 20:45:22 UTC (12:33-12:45 PM PT), not all 26. Not edited in that window: Template - Remodeling - CRM - Sync Records to Twenty (sv95JJZr0SUtXPUf), Template - Remodeling - Scheduling - Receive Calendar Updates (NTNjmvKvSF9KTne3), Template - Remodeling - Scheduling - Check Bookings Before Retry (DnNvVlmcSpSCSKK9), Template - Remodeling - Quote Follow-Up - Follow-Up Schedule (lcPvp3oef6jKKnpr). A later settings-only save does not count as an edit by someone else.

Correction (round-1 report): every n8n version is attributed to "Abdullah Ahmed (via MCP)", so n8n cannot show who saved the 12:33-12:45 PM PT edits or ran executions 38-110. Answer: cannot tell (not confirmed); the If-route in those versions matches Mistral's own "Run 1" plan, so an earlier Mistral session is likely but not confirmed.

- Template - Remodeling - Scheduling - Understand Booking Request | n8n id eNUqCoU0LNp5IcPH | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: M6 (no timezone or resource defaults; missing -> human_review), M8. Tests: execution 131 (success): no timezone -> human_review, reason missing_timezone_or_resource. Round 2: no change.
- Template - Remodeling - Scheduling - Find Open Times | n8n id wlEqxXfWkecXBMlp | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: M6 (windows built from run time plus min_notice_hours; expires_at = offered_at + 15 min; adapter: fake), M8. Tests: execution 130 (success): no now in input -> windows relative to run time, expires_at offered_at + 15 min. Round 2: R7: one output per input item ($input.all()). Round 2 proof: the exact saved node code was run in a local harness on fake data (pass, see round2-results-2026-11-09.md); no stored n8n execution because no safe way to start a manual run exists right now (n8n MCP connector down, public API cannot run workflows) - UNPROVEN in n8n.
- Template - Remodeling - Scheduling - Book Appointment | n8n id HOFgzlVxwGEFofdB | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: M5 (processes all items; expires_at checked against now; lock_scope single_execution; durable_store OPEN D-S06; no new database/Redis/Data Table), M7, M8. Tests: execution 129 (success): 2 items selecting the same slot -> 1 appointment.confirmed, 1 appointment.conflict resource_lock_held (T-SCH-02 double booking). Round 2: no change.
- Template - Remodeling - Scheduling - Receive Calendar Updates | n8n id NTNjmvKvSF9KTne3 | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: M8. Tests: execution 152 (success): appointment.booked with revision history, reminders_active true, 0 duplicates. Round 2: R7: one output per input item ($input.all()); history copied, not mutated. Round 2 proof: the exact saved node code was run in a local harness on fake data (pass, see round2-results-2026-11-09.md); no stored n8n execution because no safe way to start a manual run exists right now (n8n MCP connector down, public API cannot run workflows) - UNPROVEN in n8n.
- Template - Remodeling - Scheduling - Send Appointment Reminders | n8n id 3xKq9UT6SOEeNPnm | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: H2 (contact from input only, no defaults), M4 (cancelled appointment -> decision skip, no throw), M6, M7, M8. Tests: execution 119 (success): H2 cases a-e, MOqT sub-execution 120. Execution 128 (success): cancelled appointment -> skip, reason appointment_cancelled (T-SCH-05). Round 2: R1: fail closed unless dnc, smsOptOut and callOptOut are real booleans (typeof !== boolean); null or missing -> human_review, reason fail_closed_missing_contact_flags, before the sink. R6: outcome now shows policy_decision (allow / blocked / sink status) and policy_reason read from the sink result (allowed sends show policy_reason null until the proposed Message Safety Check and Send diff is approved). R9: null/missing-flag cases (b)-(d) covered by the R1 harness cases. Hardcoded client settings labeled tenant_config: OPEN: needs Abdullah. Round 2 proof: the exact saved node code was run in a local harness on fake data (pass, see round2-results-2026-11-09.md); no stored n8n execution because no safe way to start a manual run exists right now (n8n MCP connector down, public API cannot run workflows) - UNPROVEN in n8n.
- Template - Remodeling - Scheduling - Check Bookings Before Retry | n8n id DnNvVlmcSpSCSKK9 | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. Round 1: Fixes: M4, M8. Tests: execution 145 (success): totals match -> adopt-existing before retry, no duplicate. Round 2: R7: one output per input item; a missing command_idempotency_key -> human_review, reason missing_id (before, every record without a key matched); only records with a non-empty, equal key count as a match. Round 2 proof: the exact saved node code was run in a local harness on fake data (pass, see round2-results-2026-11-09.md); no stored n8n execution because no safe way to start a manual run exists right now (n8n MCP connector down, public API cannot run workflows) - UNPROVEN in n8n.
- OPEN: needs Abdullah - D-S06: durable booking lock / lease store (default: single-execution scope, labeled; no new store).
- OPEN: needs Abdullah - how templates become live copies and how later fixes flow from template to live (default: nothing promoted, no live copies made).
- OPEN: needs Abdullah - where per-client (tenant) settings live and who edits them (default: hardcoded template config labeled tenant_config: OPEN: needs Abdullah; no store created).
- OPEN: needs Abdullah - wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow for these templates (proposal only, not done).
- 2026-11-09 contact lookup (Scout): Template - Remodeling - Scheduling - Send Appointment Reminders (3xKq9UT6SOEeNPnm) now call Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) with wait for completion on, right after 'When Executed by Another Workflow' (new nodes: Pick contact details for CRM lookup -> Look up contact and opt-out settings in CRM (shared, waits for result) -> Use CRM contact and opt-out settings; nothing else in the step changed, the Manual test path is unchanged). dnc, smsOptOut and callOptOut now come from the CRM record as stored; the most restrictive value wins and leadStatus DNC counts as dnc true. not_found, ambiguous_contact or a flag the CRM does not store -> null -> the step's own fail-closed check sends the item to human review. Locally tested, unproven in n8n (lookup tests 129/129 on code fetched back from n8n).
- Resolved 2026-11-09 (Abdullah approved adding what the templates need in Twenty): endCustomers now has doNotCall, emailOptOut, smsConsent, callConsent (BOOLEAN, unset = null), consentSource, ownerState (two-letter), timezone (IANA) (TEXT, unset = empty string). Consent capture time stays in the existing consentAt field. Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) reads doNotCall directly and also returns emailOptOut, owner_state, timezone and consent_channels (from smsConsent/callConsent).
- Resolved 2026-11-09 (evening, second pass): endCustomers now also has emailConsent (BOOLEAN, unset = null), and consent_channels includes 'email'. Every step's 'Use CRM contact and opt-out settings' node now also copies owner_state, timezone, consent_channels and emailOptOut from the CRM. The CRM is the source: a value it does not store becomes null; owner_state or timezone that differ between the item and the CRM become null (kept as crm_conflicts so a later step does not refill them); consent channels are limited to those both allow; an email opt-out from either side wins. Local tests: a missing CRM timezone, quiet hours from the CRM timezone and no consent channel each block the send in all 15 sending steps.
- OPEN: needs Abdullah - (1) a Twenty credential for the disabled Twenty nodes and the tenant -> clientAccount map; (2) the new fields are empty on all existing records (no backfill), so in live mode sends stay blocked until they are filled.
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Scheduling (DfRXMSufrfFMOF5K), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Understand Booking Request; 1. Find Open Times; 2. Book Appointment; 3. Check Bookings Before Retry; 4. Receive Calendar Updates; 5. Send Appointment Reminders. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 6 old separate workflows (eNUqCoU0LNp5IcPH, wlEqxXfWkecXBMlp, HOFgzlVxwGEFofdB, DnNvVlmcSpSCSKK9, NTNjmvKvSF9KTne3, 3xKq9UT6SOEeNPnm) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
