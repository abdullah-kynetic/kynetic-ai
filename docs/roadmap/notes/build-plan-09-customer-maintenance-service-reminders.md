# BUILD PLAN 09: Customer maintenance / service reminders

_Twenty note `2f47e907`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Customer maintenance / service reminders
*Pointer: main note "SYSTEMS INDEX". Service family: Customer Growth. n8n folder: Kynetic AI / Customer Growth. Updated 2026-11-09. Source: GitHub spec section 8.9 (docs/systems/maintenance.md on branch claude/project-thread-kj2v2h). LATER backlog.*

**For the building LLM (reads only Twenty and n8n):** complete build plan, all PROPOSAL until verified. Build only net-new workflows, INACTIVE, tagged DEV, no real credentials/sends; follow "N8N ORGANIZATION GUIDE". Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno).

## 0. Where we are today (read-only inventory 2026-11-09)
- **MISSING**: No customer-facing maintenance/warranty workflow found in repo, n8n VPS list, or Twenty objects.
- **PARTIAL**: VPS mMBRyfd3NiWLLLQI "DEV - reminder" is an inactive appointment-reminder dev workflow; not a maintenance plan engine.
- **UNKNOWN**: Original intent of "maintenance" is unrecoverable; default = customer service/warranty reminders; internal platform maintenance is the separate "PLATFORM" note.

## 1. Build plan
**Outcome:** remind eligible customers of contract/manufacturer maintenance, warranty inspections or seasonal service and enable a request to book. For HVAC/pool services, recurring maintenance may fit; for remodelers, warranty check-ins may be more appropriate.

**Scope ambiguity:** this defines customer-facing reminders. Internal platform updates/backups/monitoring are NOT part of this automation. First onboarding decision chooses plan type: recurring service, warranty/seasonal check-in, or disabled for the niche.

**MVP:** curated service plans + one reminder + reply/booking task. Phase 2: recurring agreements, rescheduling and technician routing. No unapproved DIY/safety advice or contract/billing claims.

```text
plan.created or service.completed -> compute due window -> validate history/eligibility
-> pre_due_reminder -> awaiting_customer
  -> booking_requested -> scheduling
  -> callback_requested -> human
  -> snoozed -> recheck at chosen safe date
  -> declined/not_applicable -> no further reminder of same category
-> due/overdue -> bounded reminder if permitted
completed -> next recurrence exactly once | plan_ended
```

Use local service timezone and explicit recurrence semantics. Transactional service notices vs marketing need distinct approved policies; declining marketing is not automatically cancelling contract-required notices. Unknown histories default review, not “overdue.” Appointment pending suppresses book-now prompts.

**Onboarding:** plan/service categories; anchor and interval; service-history source; warranty end; approved notice category/copy; advance windows/cadence; snooze/decline behavior; customer timezone; seasonal rules; eligible resources; prices only if source verified; plan cancellation and service staff owner.

**Records/events:** asset/plan minimum necessary fields, interval/version, last/next service, reminder instance, preference, appointment. `maintenance.plan_created`, `maintenance.due`, `maintenance.reminded`, `maintenance.snoozed`, `maintenance.declined`, `maintenance.completed`, `maintenance.plan_ended`.

**n8n:** `maintenance-due-scanner`, `maintenance-policy`, `maintenance-reminder`, `maintenance-reply`, `maintenance-completion-reconcile`.

| Portal client UI | Headless backend | Data/external |
|---|---|---|
| plans/assets, service dates, due/overdue list, reminder instance, source state and appointment | date computation, dedupe, policy, reminders, completion reconciliation and recurrence | Twenty plan/asset/customer/history; calendar/channel adapters |
| service staff correct date with reason, snooze/not-applicable, request booking or claim reply | corrections create revision/recompute next date without deleting history | calendar remains booking authority |

**Failure:** bounced service-critical reminder makes task; conflicting completion IDs review; missing timezone defers optional marketing; stale reminder queue checks new completion/appointment immediately before sending; no infinite recurrence after plan termination.

**Metrics:** active eligible plans; due in window; reminded/due; booked/reminded; completed/reminded (keep separate); opt-out/snooze; corrected due-date / due calculations; overdue snapshot. No “incremental revenue” without comparison design.

**Tests/acceptance:** month-end/leap-year/DST recurrences; same scanner twice one reminder; completion cancels queue; reschedule changes linked appointment; snooze honored; service notice vs marketing classification respected; unknown history review; all date and tenant calculations deterministic. Acceptance requires a recurrence-version audit and correct next instance exactly once.

## 2. n8n placement and naming
- Folder: **Kynetic AI / Customer Growth**. Sandbox copies: **Kynetic AI / Sandbox (DEV)** named "DEV - maintenance | <function>", tagged DEV. Promote only after an explicit activation approval from Abdullah.
- Workflows: maintenance-due-scanner, -policy, -reminder, -reply, -completion-reconcile. Display name rule: "Maintenance | <function>".
- Every workflow: INACTIVE, error workflow set, executions without data saved, policy via the shared policy node, sends only through the sink adapter until approved.

## 3. Requirements and tests (traceability)
- **R-MNT-01** First onboarding decision: recurring service, warranty check-in, or disabled. Workflow: maintenance-policy. Fields: tenant_config.maintenance_mode. Test: T-MNT-01.
- **R-MNT-02** Recurrence correct across month-end, leap year, DST; scanner run twice -> one reminder. Workflow: maintenance-due-scanner. Fields: Plan/asset (new), local tz. Test: T-MNT-02, T-MNT-03.
- **R-MNT-03** Completion cancels queued reminder; unknown history -> review, not overdue. Workflow: maintenance-completion-reconcile. Fields: clientJobs.status. Test: T-MNT-04, T-MNT-05.
- **R-MNT-04** Service notice vs marketing classification respected; snooze honored. Workflow: maintenance-reminder. Fields: preference. Test: T-MNT-06.

## 4. Open gaps and unknowns
- Niche interpretation must be confirmed before template approval.

## Built so far (2026-11-09)

First niche: all types of remodelers (bath, kitchen, basement, deck, any remodeler). These workflows are the Remodeling templates for that niche. For remodelers the default mode is warranty / seasonal check-ins (OPEN: needs Abdullah); recurring service and disabled are also supported.

Built 2026-11-09 (batch A, built and checked by Scout). All workflows below are templates: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). Names follow the full-name rule (Template - Remodeling - Maintenance and Service Reminders - ...). Every send goes through Template - Remodeling - Shared - Message Safety Check and Send (MOqT97N0ItVyKIno). No plan/asset object was created in Twenty (D-S04); plans are fake inputs.

- Template - Remodeling - Maintenance and Service Reminders - Find Customers Due for Service | n8n id tufVKF4PxpQ2Oi3H | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. maintenance-due-scanner (R-MNT-02): next due = last service or anchor + interval months, clamped to month end (T-MNT-02: Jan 31 -> Feb 28, Feb 29 2024 + 12 -> Feb 28 2025, Nov 30 2027 + 3 -> Feb 29 2028); local date from the customer's IANA timezone (DST day tested); fixed instance key so a second scan gives one reminder (T-MNT-03); unknown history, bad timezone or dates -> review, never overdue; ended plans and dues after plan end -> no reminder. Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_mnt.json; no n8n test run because the editor needs sign-in).
- Template - Remodeling - Maintenance and Service Reminders - Check Reminder Rules | n8n id 6wVjWIDcjmP0olax | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. maintenance-policy (R-MNT-01, R-MNT-04): mode recurring_service / warranty_check_in / disabled; service notice vs marketing kept apart (declining marketing never stops a warranty notice; marketing needs explicit opt-in); declined category, snooze, pending appointment (no book-now prompt), 2 reminders per instance (OPEN). Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_mnt.json; no n8n test run because the editor needs sign-in).
- Template - Remodeling - Maintenance and Service Reminders - Send Service Reminder | n8n id M5Bxym1ukp5Uea3f | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. maintenance-reminder: rechecks right before sending (service completed, appointment booked, plan not active -> cancel); strict boolean dnc/smsOptOut/callOptOut (+ emailOptOut for email); approved copy per category only (no DIY/safety advice, no prices); sends via MOqT with the instance key as idempotency key; outcome shows policy_decision and policy_reason. Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_mnt.json; no n8n test run because the editor needs sign-in).
- Template - Remodeling - Maintenance and Service Reminders - Sort Replies and Hand Off to Team | n8n id jGnqItn0GCwTQTHQ | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. maintenance-reply: opt-out rule same as Missed-Call Text-Back - Sort Replies; BOOK -> booking task with proposal to Scheduling - Understand Booking Request (calendar stays booking authority); CALL -> callback task; later -> snooze 30 days (OPEN); not interested -> declines that category only; anything else -> human task; no automated replies. Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_mnt.json; no n8n test run because the editor needs sign-in).
- Template - Remodeling - Maintenance and Service Reminders - Record Finished Service and Schedule Next One | n8n id 67ijXIbXpikSNN6k | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. maintenance-completion-reconcile (R-MNT-03, T-MNT-04, T-MNT-05): completion cancels queued reminders; conflicting completion ids within 3 days -> review; next instance created exactly once; plan ended or past end date -> no recurrence; a date correction creates a new revision and keeps history. Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_mnt.json; no n8n test run because the editor needs sign-in).
- OPEN: needs Abdullah - maintenance mode for remodelers (default warranty_check_in); reminder copy per category (demo drafts, need approval); advance window, reminders per instance, snooze length (defaults 14 days, 2, 30 days); whether contract-required notices continue after a STOP (counsel); where plans/assets live (no Twenty object without an approved metadata delta, D-S04); durable reminder-key store (D-S06).
- OPEN: needs Abdullah - how templates become live copies; where per-client settings live (default: hardcoded config labeled tenant_config: OPEN: needs Abdullah); wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow (proposal only).
- 2026-11-09 contact lookup (Scout): Template - Remodeling - Maintenance and Service Reminders - Send Service Reminder (M5Bxym1ukp5Uea3f) now call Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) with wait for completion on, right after 'When Executed by Another Workflow' (new nodes: Pick contact details for CRM lookup -> Look up contact and opt-out settings in CRM (shared, waits for result) -> Use CRM contact and opt-out settings; nothing else in the step changed, the Manual test path is unchanged). dnc, smsOptOut and callOptOut now come from the CRM record as stored; the most restrictive value wins and leadStatus DNC counts as dnc true. not_found, ambiguous_contact or a flag the CRM does not store -> null -> the step's own fail-closed check sends the item to human review. Locally tested, unproven in n8n (lookup tests 129/129 on code fetched back from n8n).
- Resolved 2026-11-09 (Abdullah approved adding what the templates need in Twenty): endCustomers now has doNotCall, emailOptOut, smsConsent, callConsent (BOOLEAN, unset = null), consentSource, ownerState (two-letter), timezone (IANA) (TEXT, unset = empty string). Consent capture time stays in the existing consentAt field. Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) reads doNotCall directly and also returns emailOptOut, owner_state, timezone and consent_channels (from smsConsent/callConsent).
- Resolved 2026-11-09 (evening, second pass): endCustomers now also has emailConsent (BOOLEAN, unset = null), and consent_channels includes 'email'. Every step's 'Use CRM contact and opt-out settings' node now also copies owner_state, timezone, consent_channels and emailOptOut from the CRM. The CRM is the source: a value it does not store becomes null; owner_state or timezone that differ between the item and the CRM become null (kept as crm_conflicts so a later step does not refill them); consent channels are limited to those both allow; an email opt-out from either side wins. Local tests: a missing CRM timezone, quiet hours from the CRM timezone and no consent channel each block the send in all 15 sending steps.
- OPEN: needs Abdullah - (1) a Twenty credential for the disabled Twenty nodes and the tenant -> clientAccount map; (2) the new fields are empty on all existing records (no backfill), so in live mode sends stay blocked until they are filled.
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Maintenance and Service Reminders (Jq4qrLPd4NCoitDl), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Find Customers Due for Service; 1. Check Reminder Rules; 2. Send Service Reminder; 3. Sort Replies and Hand Off to Team; 4. Record Finished Service and Schedule Next One. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 5 old separate workflows (tufVKF4PxpQ2Oi3H, 6wVjWIDcjmP0olax, M5Bxym1ukp5Uea3f, jGnqItn0GCwTQTHQ, 67ijXIbXpikSNN6k) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
