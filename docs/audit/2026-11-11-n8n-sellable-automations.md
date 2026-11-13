# n8n audit, part 2: the automations we would sell and use (2026-11-11)

Read-only, like part 1 (`2026-11-11-n8n-audit.md`). Scope set by Abdullah: (a) the automations built around the Kynetic Restoration demo, and (b) the automations created for the portal's back-end management. Source: workflow details read from n8n.kyneticai.com on 2026-11-11 (Nora, Emily, Front Door, Back-End Manager Agent, Message Safety Check and Send (Callable), Sync Records to Twenty, Error Alert, Daily Health Check), plus `retell/builds/kynetic-restoration/build-ids.md`, `retell/builds/emily-speed-to-lead/HANDOFF.md`, `docs/portal-n8n-contract.md`, `docs/plans/PLAN1-REMAINING.md`. Nothing was run, changed or activated. Nora, Emily and the Restoration (Demo) records are no-touch; this is reading only.

## Correction to part 1

Part 1 said the 101 templates were "built and tested by hand" and could be "finished". More precisely, from reading the ones above: **every template workflow I read is a Code-node simulation.** It decides what should happen (consent, quiet hours, opt-out, routing) on fake data and writes the answer to a test-only sink. None of them calls Twenty, Cal.com, ElevenLabs, Twilio or email. "Finish" therefore means building the real adapters, not flipping a switch. The only workflows on the VPS that touch real systems are the contact form (active) and the Cal.com booking text (inactive).

## A. The Restoration demo automations

### What exists

| Workflow | VPS ID (repo ID) | State | What it does |
|---|---|---|---|
| Nora Restoration AI Receptionist | `PzvylXW0CpRJObnq` (`2PFWFqBM0wabADk6`) | Inactive, 40 nodes | The back end for the Retell voice receptionist for the fictional Kynetic Restoration (Austin water damage). Five webhooks the voice agent calls, listed below. |
| Emily Restoration Speed to Lead | `hK3skYh0R06LLJvd` (`0PwP1tUf4478lNbf`) | Inactive, 40 nodes | Copy of Nora with its own webhook paths. Paused build copy; Emily's Retell tools still pointed at Nora's workflow when last checked (2026-09-29). |
| Kynetic Restoration, Inbound SMS Opt-Out Handler | cloud only (`DaOVUpSChkjaNg3B`, repo archive) | **Not on the VPS** | STOP handling for the demo. Missing on the VPS. |

Nora's five entry points (all POST webhooks, no auth):

1. **Job Query by Phone**: looks up existing jobs by caller phone before booking another (returns to the voice agent).
2. **Job Creation** (booking): creates Contact, Job and Call records, then an AI agent writes a confirmation text, sent by Twilio from +16692660586.
3. **Log Inquiry**: creates Contact and Call, an AI agent writes an internal email to Abdullah, "[Kynetic Restoration] New inquiry".
4. **Log Emergency**: creates Contact and Call, texts the caller a calm confirmation, emails the team "[Kynetic Restoration] EMERGENCY".
5. **Post-call Analysis**: a reconciliation agent that rereads the transcript and repairs anything the live tools failed to log. The canvas note says "DISABLED, pending rebuild on Notion".

Booking itself is not in n8n. Cal.com (event type 7025524, "Water Damage Assessment") is called from inside the Retell agent's tools.

### Findings

1. **It cannot run on the VPS as it stands.** The Twilio (`aoIjAKkkoPR85aOq`), Notion (`pPuCuC18ekEbAfp0`) and Gmail (`dil4wMogas9aOWKP`) credentials these workflows name are not among the 8 credentials on the VPS (the VPS Twilio and Gmail credentials have different IDs). The Gemini model nodes have no credential either; Nora's Google AI credential was n8n-cloud managed. Importing the workflows moved the graph but not the connections.
2. **The data layer is Notion.** Contacts, Jobs, Calls and Clients are Notion databases. Notion is legacy and nothing new goes there, and `PLAN1-REMAINING.md` already says the Notion to Twenty swap needs approval. A demo shown to a prospect on Notion contradicts "one unified CRM".
3. **SMS bug.** The booking-text output parser says "Convert phone number with AU prefix, e.g. +61480089451". That is inherited from the template and would mangle a US number. Flag only; Nora is frozen.
4. **No safety gate on the texts.** The booking and emergency texts have no consent, DNC or quiet-hours check and no "Reply STOP" line. They go to someone who just called in, so the risk is lower than cold SMS, but it does not match the Message Safety Check the new templates use, and the matching STOP handler is cloud-only.
5. **Webhooks are unauthenticated** (KI-005). Anyone with a path UUID can write contacts and trigger texts and emails once active.
6. **The AI writes customer-facing text with no guardrail.** The agents compose the SMS freely. The new Back-End Manager template adds forbidden-wording checks, a confidence floor and a human-task fallback; Nora has none of that.

### What this means for selling

The sellable product behind the demo is the **Inbound AI Receptionist** (Plan 2, currently paused in `KYNETIC_CONTEXT.md`). Nora and Emily are the reference, not the product. The productized version already exists as a template family, `Template - Remodeling - Inbound Receptionist` (`oJKV3Q9gxPmKV4j4`), with five sections that map one to one onto what Nora does:

| Nora behavior | Template section | Template ID |
|---|---|---|
| Receive the call event | Receive Inbound Calls | `Mkl9bjSupuXcUoC5` |
| Look up caller by phone | Verify Caller Identity | `AVcrYJTCA4rvezxK` |
| Job Creation, Log Inquiry, bookings | Answer Questions, Take Messages and Book | `A3CY5KcuZvtpm5dw` |
| Emergency routing | Transfer Fallback When No One Answers | `np2PfzE1OjVsfCsl` |
| Confirmation text, internal email, post-call analysis | After-Call Summary and Follow-Up Text | `eCbAsTj0pARLcFO4` |

Verdict: **KEEP Nora and Emily untouched as demo reference. SELL the template version, built on Twenty. DO NOT port Nora's Notion nodes.** Open for Abdullah: `docs/STATUS.md` puts the first delivery package at Alex + one CRM + scheduling + follow-up, with the receptionist not in it. Confirm whether the receptionist is in the first package or a Plan 2 add-on, because it changes what has to be finished first.

## B. The portal back-end management automations

These are the automations that run behind every client rather than being the thing the client buys. They are the n8n half of "portal = display, n8n = automation".

### The portal side of the contract (real, in `crm/`)

- n8n to portal: `POST /api/hooks/leads/{tenantId}`, HMAC-SHA256 over `timestamp.rawBody`, 300 second window, durable dedupe on source + externalId.
- Portal to n8n: `lead.created`, `deal.stage_changed`, `call.completed`, signed with a plain HMAC, no freshness window, delivered at least once (retry limit 6, backoff to one hour). n8n must dedupe.
- Service reads: `GET /api/service/contacts/{id}` with a per-tenant service token.
- Provider hooks for voice and Twilio inbound exist.

### The n8n side

| Workflow | ID | Role | Real or stub | What is missing |
|---|---|---|---|---|
| Front Door Webhook | `xhPM1aUfsdXqi9hN` | One entry for every event: labels it, picks a fixed template, the manager agent, or a human task. Opt-outs always take the fixed rule. | Logic only | **Signature check not built, so every real webhook event becomes a human task (fails closed).** Dedupe is per execution only (D-S06). Tenant list hardcoded to two demo tenants. |
| Back-End Manager Agent | `EZgdJlOAcTufAtsG` | An AI agent for messy events. Fixed rules run before it (opt-out, prompt injection, human-owned contacts, missing flags) and after it (allowed actions only, confidence at least 0.8, no prices, links or booking claims, recipient comes from the CRM). It can read four template sections as tools. | Logic plus an agent node | No model credential (set to OpenAI gpt-4.1-mini; the VPS has an OpenRouter credential named Blitz and no OpenAI). Tools are fake adapters. Route proposals are never executed. |
| Message Safety Check and Send (+ Callable) | `MOqT97N0ItVyKIno`, `YOEnu9pkfg4TEZBI` | The one gate every send goes through: tenant active, channel on, production approved, suppression, DNC, opt-out, FL/OK ban, consent per channel, lease, timezone, quiet hours 8 to 21. | Policy is real logic; **the send is a test-only sink** that rejects any non-test number or address and sends nothing | A real send adapter (Twilio SMS, email), the production approval flag, and a decision on who owns this gate. |
| Error Alert | `gTV1LEsH51TaytUx` | Turns any workflow failure into an alert record with a dedupe key. | Logic; sink captures only | Recipient and channel marked "OPEN: needs Abdullah". Not set as the error workflow on any workflow, including the live contact form. |
| Look Up Contact and Opt-Out Settings in CRM | `otGXbuaTgvSL8h2h` | Reads consent and opt-out flags from Twenty. | Not read in full | Needs checking against the Twenty credential. |
| Look Up Existing People and Recent Referrals | `mKKf72TrQG7klpbl` | Lookup helper. | Not read | |
| Record Opt-Outs on Do-Not-Contact List | `nYy2G48xRai2anwX` | Writes STOP and wrong-number replies. | Logic | Where opt-outs persist is open (D-S04); email opt-out has no home yet. |
| CRM family (6 sections) | parent `hU0LVdY7VrahZvFJ` | Check CRM Field Setup, Receive Leads from Sources, Clean Up and Merge Duplicates, Sync Records to Twenty, Resolve Conflicting Updates (most restrictive wins for opt-outs), Check Record Totals Match. | **Sync Records to Twenty is a labeled stub**: it builds a payload and sends nothing (no HTTP node, no credentials). Honors the rules: no DELETE, under 100 requests per 60 seconds. | The real Twenty read and write adapters. |
| Platform Health Checks (4 sections) | parent `hQI9WmIdHytWBQOr` | Daily Health Check (Twenty up, n8n up, failed executions, queue age, silent webhooks, **flags any active workflow not on an allow list**), Credential Expiry, Backup and Restore Drill, Retry Failed Messages Safely. | Logic on fake telemetry | The read-only telemetry source is not built. The allow list contains only the contact form `WxIh0Hw4lQodY1Xa`, which matches what is live today. |

### Overlap and conflict to settle

- **Who decides consent, quiet hours and DNC?** The portal has `outbound/gate.ts`; the new plan moves the decision to n8n and the portal logs it (automation-map B3, still marked "conflict"). Today both exist. Pick one sender and one gate before any real message goes out.
- **Two ways in.** The portal's lead webhook has HMAC and durable dedupe; the Front Door has neither yet. The portal's is the stronger, so the Front Door should adopt the same signature scheme.
- **Duplicate small workflows.** `DEV - error-alert`, `owner-alert`, `missed-call`, `reminder` overlap the shared and family templates (see part 1).

### Open decisions recorded inside the templates

Counted by the "OPEN: needs Abdullah" markers I read: tenant config location, webhook signature verification, durable dedupe (D-S06), opt-out persistence (D-S04), alert recipient and channel, model credential for the manager agent, whether agent route proposals may auto-run, the confidence threshold, production activation approval, and the telemetry source for health checks. None can be closed without Abdullah.

## Recommended order for what we sell and use

1. Decide the single gate and sender (portal or n8n). Everything below depends on it.
2. Real adapters, in this order: Twenty read and write (CRM sync, lookups, opt-outs), signed Front Door, real send through the Safety Check, Error Alert wired as the error workflow with a real recipient, health telemetry.
3. Then the client-facing systems on top, Alex chain first, then scheduling, quote follow-up and missed-call text-back, then the receptionist (Nora's lineage) if confirmed for the first package.
4. Rebuild the Restoration demo's data layer on Twenty before showing it to a prospect.

Each step that touches a live system (credentials, activation, a real send, a real submit) needs Abdullah's yes on that exact change.

## Not checked

The other 74 section workflows beyond the ones named; Nora's Retell agent and Emily's Retell tools (Retell not read this pass); whether the Twenty "Kynetic Restoration (Demo)" records still match the Notion rows; execution history for Nora and Emily (none on record in the 123 recorded executions).

## Addendum: Twenty is the back-end CRM (Abdullah, 2026-11-11 5:30 PM CT)

Abdullah's correction: the back-end CRM is Twenty, not Notion and not a portal-owned store. I read Twenty (read-only) to check what that means for the automations above.

- **Twenty has no workflows and no workflow runs.** All automation is n8n acting on Twenty. There is nothing to audit inside Twenty itself.
- **Twenty already has the data model for the receptionist and the policy checks.** The custom object `endCustomer` ("a client's own customer or caller handled by the voice receptionist") carries: `callOptOut`, `smsOptOut`, `emailOptOut` (each with opt-out dates for call and SMS), `doNotCall`, `smsConsent`, `callConsent`, `emailConsent`, `consentSource`, `consentText`, `consentAt`, `ownerState`, `timezone`, `leadSource`, `leadStatus`, `attemptCount`, `nextAttemptAt`, `lastOutcome`, `firstRingAt`, `secondsToFirstRing`, `lastCallId`, plus relations to `clientAccount`, `clientJobs` and `customerInteractions`. The `person` object has `smsConsent`, `smsOptOut`, `emailOptOut`, `timezone` and `contactRole` (added 2026-11-10 02:43 to 02:45Z). Other objects exist for call logs, customer interactions, client accounts, support tickets and referral submissions.

What changes in the findings above:

1. **Nora's Notion data layer has a ready replacement.** The Notion Contacts, Jobs and Calls databases map to Twenty `endCustomer`, `clientJobs` and `call_logs`/`customerInteractions`, with `clientAccount` replacing the Notion Clients row. The schema work is done; the Nora and Emily workflows still point at Notion. The swap is a workflow rebuild, not a schema project. (It would need a yes, and Nora and Emily stay frozen, so the swap belongs in the template, not in Nora.)
2. **Open decision D-S04 is partly answered.** The templates say `endCustomers` has no email opt-out field. It now has `emailOptOut` (and `emailConsent`). The Record Opt-Outs and Safety Check templates can write and read it. Whether `person` or `endCustomer` is the record the policy reads still needs a call.
3. **The template contact shape maps almost field for field.** `dnc` = `doNotCall`; `smsOptOut`, `callOptOut`, `emailOptOut` = same names; `owner_state` = `ownerState`; `timezone` = `timezone`; `consent_channels` can be built from `smsConsent`, `callConsent`, `emailConsent`. **Not in Twenty yet:** `human_owned`, `suppressed_global`, `suppressed_tenant`. Without them the Safety Check fails closed or has to default them.
4. **The portal-vs-n8n "who decides" question narrows.** Whichever system runs the gate, the lists it reads (consent, opt-out, DNC) should live in Twenty. The portal then displays and logs. This matches "portal = display, n8n = automation, Twenty = records".
5. **The "CRM Sync Records to Twenty" stub matters more.** If Twenty is the source of truth, the real read and write adapter to Twenty is the first thing to build, ahead of the send adapter. The `Twenty self-hosted` credential already exists on the VPS and is the right one.

Revised order for the back-end automations: (1) Twenty read and write adapter plus the three missing policy fields, (2) opt-out writes into Twenty, (3) signed Front Door, (4) real send through the Safety Check, (5) Error Alert wired with a recipient, (6) health telemetry.

Rule reminders that still apply: Twenty GET and approved writes only, never REST DELETE, no more than 100 requests per 60 seconds, env names `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY`.
