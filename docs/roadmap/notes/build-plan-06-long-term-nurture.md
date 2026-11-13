# BUILD PLAN 06: Long-term nurture

_Twenty note `64248a90`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Long-term nurture
*Pointer: main note "SYSTEMS INDEX". Service family: Pipeline Conversion. n8n folder: Kynetic AI / Pipeline Conversion. Updated 2026-11-09. Source: GitHub spec section 8.6 (docs/systems/nurture.md on branch claude/project-thread-kj2v2h). LATER backlog.*

**For the building LLM (reads only Twenty and n8n):** complete build plan, all PROPOSAL until verified. Build only net-new workflows, INACTIVE, tagged DEV, no real credentials/sends; follow "N8N ORGANIZATION GUIDE". Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno).

## 0. Where we are today (read-only inventory 2026-11-09)
- **PARTIAL**: Twenty native campaign objects (`messageCampaigns` with status/counts, `messageLists`, `campaignDeliveries` with bounce/complaint timestamps, `messageSuppressions`, `blocklists`), email-oriented.
- **PARTIAL**: Client-portal outbound sequences (call/SMS step sequences) and email module; no nurture track/content-version model.
- **MISSING**: Track/subscription, content version/expiry, scheduler, engagement ingest. listmonk not evaluated or installed.

## 1. Build plan
**Outcome:** provide permissioned, relevant education/check-ins over time and recognize renewed intent, without colliding with sales or post-service journeys. Content is approved and cadence bounded.

**MVP:** audience rules + 2–3 approved evergreen messages + preference/opt-out + intent handoff. Dynamic AI-written outbound content is excluded until separately reviewed; AI may classify replies but cannot silently expand promises.

```text
explicit_entry -> validate consent/preferences -> choose content track
-> scheduled_item -> current-state/lease recheck -> send -> next_due
  -> engagement/intent -> handoff Alex/human/scheduling
  -> completed_track -> dormant_or_permissioned_next_track
any state -> unsubscribed | suppressed | bounced | active_sales | human_owned
```

Active Alex/Emily/quote conversations suppress nurture; won work exits sales nurture and only later enters appropriate customer journeys; unsubscribed applies at correct channel/purpose and suppresses all optional marketing under restrictive default. Click tracking needs privacy/consent review and is not a proxy for consent.

**Onboarding:** entry basis, audience/service tracks, approved content library/version/expiry, from identity, frequency/maximum, quiet hours, preference management, reply owner, intent taxonomy, bounce/complaint process and calendar seasonal exclusions.

**Records/events:** track/subscription, content version, schedule, engagement event source, preference and reason for exit. `nurture.enrolled`, `nurture.item_due`, `nurture.sent`, `nurture.replied`, `nurture.intent`, `nurture.exited`, `preference.changed`.

**n8n:** `nurture-entry`, `nurture-scheduler`, `nurture-content`, `nurture-dispatch`, `nurture-engagement`, `nurture-exit`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| track/membership, approved content/version, next step, engagement and exit reason | recurring selection, policy and cooldown, delivery, bounce/reply and handoff | Twenty subscription/content/attempt/event; email/SMS approved adapter |
| marketing edits drafts; only approved content becomes active; user can suppress contact | backend separates draft approval from send; live sends cannot be triggered by editing UI HTML | provider delivery/complaint signals ingested headlessly |

**Failure:** expired content pauses track; permanent bounce updates status and alerts; ambiguous reply human; duplicate workers lease same content item once. Portal outage never delays incoming opt-out ingestion.

**Metrics:** enrolled eligible people; active at start of period; delivered/enrolled due; replies/delivered; renewed intent/active exposed; appointments after intent; unsubscribe/complaint per delivered; content fatigue and track completion. Opens are unreliable due to privacy/image behavior and not a primary success metric.

**Tests/acceptance:** active quote cancels send; appointment due prioritizes confirmations; STOP/unsubscribe immediately blocks queue; re-entry obeys permission; content draft cannot send; duplicate schedule one attempt; bounce mapped correctly. Acceptance requires deterministic track state and a fresh intent handoff without duplicate lead/opportunity.

## 2. n8n placement and naming
- Folder: **Kynetic AI / Pipeline Conversion**. Sandbox copies during build: **Kynetic AI / Sandbox (DEV)** named "DEV - nurture | <function>", tagged DEV. Promote only after an explicit activation approval from Abdullah.
- Workflows: nurture-entry, -scheduler, -content, -dispatch, -engagement, -exit. Display name rule: "Nurture | <function>".
- Every workflow: INACTIVE, error workflow set, executions without data saved, policy via the shared policy node, sends only through the sink adapter until approved.

## 3. Requirements and tests (traceability)
- **R-NUR-01** Explicit entry basis; approved content versions only; drafts cannot send. Workflow: nurture-entry, nurture-content. Fields: Subscription/content version (new). Test: T-NUR-01.
- **R-NUR-02** STOP/unsubscribe blocks queue immediately; re-entry obeys permission. Workflow: nurture-exit. Fields: messageSuppressions, preference. Test: T-NUR-02.
- **R-NUR-03** Active quote/Alex/Emily conversation cancels send. Workflow: nurture-dispatch. Fields: Lease. Test: T-NUR-03.
- **R-NUR-04** Duplicate scheduler runs -> one attempt; bounce mapped. Workflow: nurture-scheduler. Fields: campaignDeliveries.state/bouncedAt. Test: T-NUR-04, T-NUR-05.
- **R-NUR-05** Intent handoff creates no duplicate lead/opportunity. Workflow: nurture-engagement. Test: T-NUR-06.

## 4. Open gaps and unknowns
- Default adopted (D-S05): reuse Twenty `messageCampaigns/Lists/Deliveries` for email nurture; separate schema for SMS/tracks.

## Built so far (2026-11-09)

Built 2026-11-09 by Scout (batch B). First niche: all types of remodelers. Every workflow below is a template: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). Status of every workflow: locally tested, unproven in n8n (the saved node code was run in a local harness on fake data: 555-010x numbers, invalid.example emails; no n8n test run is possible right now). Live copies: none.

Chain: Enroll Contacts -> Pick Who Is Due -> Check Content Is Approved -> Send Nurture Message; replies, bounces and complaints -> Sort Replies and Spot Renewed Interest -> Stop Nurture for Opt-Outs and Exits. Not yet linked by Execute Workflow.

- Template - Remodeling - Long-Term Nurture - Enroll Contacts | n8n id U0yqXQQQ29I6BrwQ | plan workflow nurture-entry | sends nothing | local tests 7/7 passed: explicit basis + consent -> enrolled on basement track; no entry basis -> human_review; null smsOptOut -> human_review; open quote -> defer active sales; won job leaves sales nurture; T-NUR-02 re-entry after unsubscribe without new permission; re-entry with newer permission allowed. Unproven in n8n.
- Template - Remodeling - Long-Term Nurture - Pick Who Is Due | n8n id JmsFCC9JwkBXKzew | plan workflow nurture-scheduler | sends nothing | local tests 3/3 passed: T-NUR-04 duplicate rows -> one due attempt; already attempted key skipped; schedule trigger with no source -> human_review. Unproven in n8n.
- Template - Remodeling - Long-Term Nurture - Check Content Is Approved | n8n id gTYtsroNIWHlUfeI | plan workflow nurture-content | sends nothing | local tests 4/4 passed: approved content ready; T-NUR-01 draft cannot send; expired content pauses track; past last step -> completed track. Unproven in n8n.
- Template - Remodeling - Long-Term Nurture - Send Nurture Message | n8n id Vz0kiJxL3II9Dr9x | plan workflow nurture-dispatch | sends only through Template - Remodeling - Shared - Message Safety Check and Send (MOqT97N0ItVyKIno) | local tests 6/6 passed: approved content -> safety check allows; T-NUR-03 open quote cancels send; draft content blocked; lease held by Speed-to-Lead -> policy defer; quiet hours -> policy defer; email channel with emailOptOut true -> suppressed. Unproven in n8n.
- Template - Remodeling - Long-Term Nurture - Sort Replies and Spot Renewed Interest | n8n id vog9eskWhcCBJpcU | plan workflow nurture-engagement | sends nothing | local tests 5/5 passed: T-NUR-02 STOP exits at once; keyword inside sentence -> person, not opt-out; T-NUR-06 intent -> handoff to existing person, no new lead; T-NUR-05 permanent bounce exits with alert; complaint -> suppressed. Unproven in n8n.
- Template - Remodeling - Long-Term Nurture - Stop Nurture for Opt-Outs and Exits | n8n id xryrWloYmsZrEF3q | plan workflow nurture-exit | sends nothing | local tests 2/2 passed: unsubscribe stops all optional marketing, even while paused; unknown reason -> human_review. Unproven in n8n.
- OPEN: D-S05 / D-S04 - where nurture subscriptions, content versions and exits are stored (email default: Twenty messageCampaigns/Lists/Deliveries; SMS tracks need an approved schema). Nothing is written; messageSuppression is not read or written.
- OPEN: needs Abdullah - the approved content library per client. The built-in library is TEST content only (one draft item included on purpose so drafts are proven not to send). No AI-written outbound content.
- OPEN: needs Abdullah - from identity, frequency limits and seasonal exclusions (defaults: first step 14 days after entry, quiet hours 8-21 via the shared safety check).
- Opt-out rule matches Missed-Call Text-Back - Sort Replies: only an exact STOP-type keyword opts out on SMS; a keyword inside a longer message goes to a person (possible_opt_out, high priority).
- OPEN: needs Abdullah - where per-client (tenant) settings live and who edits them (default: hardcoded template config labeled tenant_config: OPEN: needs Abdullah).
- OPEN: needs Abdullah - wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow for these templates (proposal only, not done).
- OPEN: needs Abdullah - signed webhook verification is not built; any input that arrives by webhook goes to human_review (reason webhook_signature_check_not_built).
- OPEN: D-S06 - where duplicate checks, leases and tokens are stored durably (default: input only, nothing stored).
- 2026-11-09 contact lookup (Scout): Template - Remodeling - Long-Term Nurture - Enroll Contacts (U0yqXQQQ29I6BrwQ); Template - Remodeling - Long-Term Nurture - Send Nurture Message (Vz0kiJxL3II9Dr9x) now call Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) with wait for completion on, right after 'When Executed by Another Workflow' (new nodes: Pick contact details for CRM lookup -> Look up contact and opt-out settings in CRM (shared, waits for result) -> Use CRM contact and opt-out settings; nothing else in the step changed, the Manual test path is unchanged). dnc, smsOptOut and callOptOut now come from the CRM record as stored; the most restrictive value wins and leadStatus DNC counts as dnc true. not_found, ambiguous_contact or a flag the CRM does not store -> null -> the step's own fail-closed check sends the item to human review. Locally tested, unproven in n8n (lookup tests 129/129 on code fetched back from n8n).
- Resolved 2026-11-09 (Abdullah approved adding what the templates need in Twenty): endCustomers now has doNotCall, emailOptOut, smsConsent, callConsent (BOOLEAN, unset = null), consentSource, ownerState (two-letter), timezone (IANA) (TEXT, unset = empty string). Consent capture time stays in the existing consentAt field. Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) reads doNotCall directly and also returns emailOptOut, owner_state, timezone and consent_channels (from smsConsent/callConsent).
- Resolved 2026-11-09 (evening, second pass): endCustomers now also has emailConsent (BOOLEAN, unset = null), and consent_channels includes 'email'. Every step's 'Use CRM contact and opt-out settings' node now also copies owner_state, timezone, consent_channels and emailOptOut from the CRM. The CRM is the source: a value it does not store becomes null; owner_state or timezone that differ between the item and the CRM become null (kept as crm_conflicts so a later step does not refill them); consent channels are limited to those both allow; an email opt-out from either side wins. Local tests: a missing CRM timezone, quiet hours from the CRM timezone and no consent channel each block the send in all 15 sending steps.
- OPEN: needs Abdullah - (1) a Twenty credential for the disabled Twenty nodes and the tenant -> clientAccount map; (2) the new fields are empty on all existing records (no backfill), so in live mode sends stay blocked until they are filled.
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Long-Term Nurture (jESzAz80ZHeErvSr), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Enroll Contacts; 1. Pick Who Is Due; 2. Check Content Is Approved; 3. Send Nurture Message; 4. Sort Replies and Spot Renewed Interest; 5. Stop Nurture for Opt-Outs and Exits. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 6 old separate workflows (U0yqXQQQ29I6BrwQ, JmsFCC9JwkBXKzew, gTYtsroNIWHlUfeI, Vz0kiJxL3II9Dr9x, vog9eskWhcCBJpcU, xryrWloYmsZrEF3q) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
