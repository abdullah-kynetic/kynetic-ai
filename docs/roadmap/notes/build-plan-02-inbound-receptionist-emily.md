# BUILD PLAN 02: Inbound receptionist Emily

_Twenty note `3421534f`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Inbound receptionist Emily
*Pointer: main note "SYSTEMS INDEX". Service family: Revenue Response. n8n folder: Kynetic AI / Revenue Response. Updated 2026-11-09. Source: GitHub spec section 8.2 (abdullah-kynetic/kynetic-ai, branch claude/project-thread-kj2v2h, docs/systems/emily.md). Plan 2 / LATER backlog.*

**For the building LLM (reads only Twenty and n8n):** complete build plan, all PROPOSAL until verified against vendor docs, Twenty metadata and n8n node behavior. Build only net-new workflows, INACTIVE, tagged DEV, no real credentials/sends; follow "N8N ORGANIZATION GUIDE". Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, real outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno: policy decide + sink send).

## 0. Where we are today (read-only inventory 2026-11-09)
- **EXISTING**: Legacy Retell-era workflow copy (archive only, 40 nodes incl. 8 Notion nodes): n8n Cloud id 0PwP1tUf4478lNbf; VPS copy hK3skYh0R06LLJvd inactive. KI-004: 13 Notion nodes. Not to be edited.
- **UNKNOWN**: Live Emily agent agent_affef8… was **not inspected** (prohibited). Behavior beyond the repo snapshot is unknown.
- **MISSING**: No net-new sandbox receptionist, FAQ schema, identity-verification policy, message/transfer fallback or simulated inbound harness.
- **EXISTING**: Twenty has native `messages`, `messageThreads`, `tasks`, `callLogs`, `callRecordings` objects usable for message/callback records.

## 1. Build plan
**Outcome:** answer routed inbound business calls, identify caller intent, resolve only approved requests, book/reschedule within scheduling policy, take a structured message, and transfer urgent/high-value requests. This plan does not authorize examining or modifying live Emily.

**MVP:** net-new sandbox receptionist with simulated inbound call, FAQ mock and message-taking. **Phase 2:** calendar tools/transfer. **Phase 3:** approved tenant knowledge and multilingual support only if quality-tested.

```text
inbound_received -> identifying -> intent_detection
  -> FAQ | scheduling | existing_customer_lookup | transfer | message_taking
  -> confirmation -> ended
any state -> human_requested | safety_exit | failed_handoff
ended -> after_call_summary -> eligible_transactional_followup | closed
```

Existing-customer lookup requires minimum verified identifiers, not caller ID alone for sensitive disclosure. Unknown callers receive only public/general scheduling data. Reception does not create a duplicate lead if an existing person is confidently matched; uncertain identity creates review.

**Onboarding:** public greeting, services, hours, service area, escalation matrix, emergency instructions, transfer destinations and fallback order, FAQ approved answers, caller verification policy, appointment permissions, message recipients, recording/AI disclosure, maximum ring/transfer waits and spam policy.

**Records/events:** call/callback/message rather than always sales lead; link caller to existing opportunity when verified. `inbound_call.received`, `reception.intent_classified`, `message.created`, `transfer.result`, `appointment.changed`, `reception.completed`. Fields: callback number (confirmed), intent, urgency, summary, assigned team, consent for transactional followup.

**n8n boundaries:** `reception-inbound`, `reception-identity`, `reception-tools`, `reception-after-call`, `reception-transfer-fallback`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| front-desk call/message queue, transfer outcomes, callback tasks, approved FAQ status, recordings only if permissioned | inbound routing context, lookup, tool execution, transfer fallback, after-call event and dedupe | Twenty conversation/message/task; voice and telephony; external calendar |
| front desk can claim/complete message, invoke controlled callback or reschedule; admin changes approved FAQ via source configuration, not arbitrary prompt edit | takeover suppresses automated messages; command cannot unerase booking or transcript history | communication channel stays provider-controlled |

**Failures/handoffs:** caller says “person,” repeated silence/no-input, distressed caller, inaccessible knowledge, failed transfer. Never make emergency claims; play approved instruction. Summaries distinguish caller statement from confirmed business fact. Tool error gives honest fallback (“I can take a message”), not fake success.

**Metrics:** answered inbound calls offered to sandbox/new system; containment = calls completed without human / eligible answered; transfer success / transfer attempted; callback completion within SLA / messages due; booking accuracy / AI-booked; abandoned calls / offered; FAQ unsupported count. Avoid calling every short call “resolved”; sample quality reviews.

**Tests:** existing caller cannot retrieve private details using only spoofable caller ID; two inbound calls same caller do not merge appointments incorrectly; transfer timeout yields one task/message; Emily active prevents Alex/nurture; appointment cancellation respects revision; malicious caller asking for tool credentials gets none; no live Emily asset touched. Acceptance requires correct summaries, tenant routing and human fallback.

## 2. n8n placement and naming
- Folder: **Kynetic AI / Revenue Response**. Sandbox copies during build: **Kynetic AI / Sandbox (DEV)** named "DEV - emily | <function>" and tagged DEV. Promote only after an explicit activation approval from Abdullah.
- Workflows: reception-inbound, reception-identity, reception-tools, reception-after-call, reception-transfer-fallback. Display name rule: "Emily | <function>".
- Every workflow: INACTIVE, error workflow set, executions without data saved, policy via the shared policy node, sends only through the sink adapter until approved.

## 3. Requirements and tests (traceability)
- **R-EMY-01** Net-new sandbox receptionist only; live Emily untouched. Workflow: reception-inbound. Test: T-EMY-01 static scan: no agent_affef8 / 0PwP1tUf4478lNbf in new code.
- **R-EMY-02** Existing-customer lookup requires verified identifiers, not caller ID alone. Workflow: reception-identity. Fields: people.phones/emails; endCustomers. Test: T-EMY-02 spoofed caller ID gets no private data.
- **R-EMY-03** Take structured message; transfer urgent calls; failed transfer -> one task + message. Workflow: reception-tools, reception-transfer-fallback. Fields: tasks.*, messages.*. Test: T-EMY-03 transfer timeout.
- **R-EMY-04** Two inbound calls from same caller do not merge appointments. Workflow: reception-identity. Fields: Conversation (new). Test: T-EMY-04.
- **R-EMY-05** Active Emily conversation denies Alex/nurture/text-back. Workflow: JourneyCoordinator. Fields: Automation Lease (new). Test: T-EMY-05.
- **R-EMY-06** Summaries separate caller statements from confirmed facts; no emergency claims. Workflow: reception-after-call. Fields: customerInteractions.summary. Test: T-EMY-06.
- **R-EMY-07** Cancellation respects appointment revision. Workflow: reception-tools + scheduling. Fields: Appointment revision (new). Test: T-EMY-07.

## 4. Open gaps and unknowns
- Legacy Emily behavior unknown; design is net-new only.
- Plan 2 is paused (D-013); Emily is [P2].

## Built so far (2026-11-09)

Built 2026-11-09 by Scout (batch B). First niche: all types of remodelers. Every workflow below is a template: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). Status of every workflow: locally tested, unproven in n8n (the saved node code was run in a local harness on fake data: 555-010x numbers, invalid.example emails; no n8n test run is possible right now). Live copies: none.

Chain: Receive Inbound Calls -> Verify Caller Identity (for existing customer and scheduling requests) -> Answer Questions, Take Messages and Book (booking changes are handed to the Scheduling templates) -> Transfer Fallback When No One Answers -> After-Call Summary and Follow-Up Text. Not yet linked by Execute Workflow. Plan 2 is paused (D-013); these are templates only.

- Template - Remodeling - Inbound Receptionist - Receive Inbound Calls | n8n id Mkl9bjSupuXcUoC5 | plan workflow reception-inbound | sends nothing | local tests 7/7 passed: asks for a person -> transfer; reschedule -> scheduling then identity; flooding -> safety exit, no emergency claims; unknown line -> human_review; spam score high -> ended; T-EMY-04 two calls same caller get separate conversations; webhook input -> human_review. Unproven in n8n.
- Template - Remodeling - Inbound Receptionist - Verify Caller Identity | n8n id AVcrYJTCA4rvezxK | plan workflow reception-identity | sends nothing | local tests 5/5 passed: T-EMY-02 caller ID alone -> public info only; caller ID + job number -> verified; spoofed caller ID + wrong name -> unverified; two people verified -> ambiguous review; unknown caller. Unproven in n8n.
- Template - Remodeling - Inbound Receptionist - Answer Questions, Take Messages and Book | n8n id A3CY5KcuZvtpm5dw | plan workflow reception-tools | sends nothing | local tests 8/8 passed: approved FAQ answered; unapproved FAQ -> honest fallback; asks for API key -> refused; tool error -> honest fallback, no fake success; T-EMY-07 cancel with stale revision -> review; cancel, verified, revision matches -> handoff; cancel when unverified -> fallback; take message with confirmed callback. Unproven in n8n.
- Template - Remodeling - Inbound Receptionist - After-Call Summary and Follow-Up Text | n8n id eCbAsTj0pARLcFO4 | plan workflow reception-after-call | sends only through Template - Remodeling - Shared - Message Safety Check and Send (MOqT97N0ItVyKIno) | local tests 5/5 passed: T-EMY-06 follow-up text allowed by safety check; summary keeps caller statements apart; unsourced facts dropped; no transactional consent -> no text; human takeover -> no automated text; missing callOptOut -> human_review. Unproven in n8n.
- Template - Remodeling - Inbound Receptionist - Transfer Fallback When No One Answers | n8n id np2PfzE1OjVsfCsl | plan workflow reception-transfer-fallback | sends nothing | local tests 2/2 passed: T-EMY-03 timeout twice -> exactly one task; answered -> no task. Unproven in n8n.
- R-EMY-01 static scan: the new workflows contain no reference to the live receptionist workflows (hK3skYh0R06LLJvd, PzvylXW0CpRJObnq), the legacy cloud copy (0PwP1tUf4478lNbf) or any agent id, and make no ElevenLabs or other voice-provider call. Live Emily and Nora were not read, copied or changed.
- OPEN: KI-002 - AI and recording disclosure wording (counsel). Recording stays off (D-S11).
- OPEN: needs Abdullah - approved emergency instruction, approved FAQ answers (hours, service area, warranty are OPEN placeholders and fall back to taking a message), transfer destinations, fallback order and wait times, message recipients.
- OPEN: needs Abdullah - voice/telephony provider connection (none built; inbound uses a simulated call event). Phone line map uses test number +15550100100 only.
- OPEN: D-S06 - receptionist lease (R-EMY-05 active receptionist call blocks Speed-to-Lead/nurture/text-back): the inbound step requests a lease but no lease store exists; the shared safety check honours a lease only if one is passed in.
- OPEN: needs Abdullah - where per-client (tenant) settings live and who edits them (default: hardcoded template config labeled tenant_config: OPEN: needs Abdullah).
- OPEN: needs Abdullah - wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow for these templates (proposal only, not done).
- OPEN: needs Abdullah - signed webhook verification is not built; any input that arrives by webhook goes to human_review (reason webhook_signature_check_not_built).
- OPEN: D-S06 - where duplicate checks, leases and tokens are stored durably (default: input only, nothing stored).
- 2026-11-09 contact lookup (Scout): Template - Remodeling - Inbound Receptionist - After-Call Summary and Follow-Up Text (eCbAsTj0pARLcFO4) now call Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) with wait for completion on, right after 'When Executed by Another Workflow' (new nodes: Pick contact details for CRM lookup -> Look up contact and opt-out settings in CRM (shared, waits for result) -> Use CRM contact and opt-out settings; nothing else in the step changed, the Manual test path is unchanged). dnc, smsOptOut and callOptOut now come from the CRM record as stored; the most restrictive value wins and leadStatus DNC counts as dnc true. not_found, ambiguous_contact or a flag the CRM does not store -> null -> the step's own fail-closed check sends the item to human review. Locally tested, unproven in n8n (lookup tests 129/129 on code fetched back from n8n).
- Resolved 2026-11-09 (Abdullah approved adding what the templates need in Twenty): endCustomers now has doNotCall, emailOptOut, smsConsent, callConsent (BOOLEAN, unset = null), consentSource, ownerState (two-letter), timezone (IANA) (TEXT, unset = empty string). Consent capture time stays in the existing consentAt field. Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) reads doNotCall directly and also returns emailOptOut, owner_state, timezone and consent_channels (from smsConsent/callConsent).
- Resolved 2026-11-09 (evening, second pass): endCustomers now also has emailConsent (BOOLEAN, unset = null), and consent_channels includes 'email'. Every step's 'Use CRM contact and opt-out settings' node now also copies owner_state, timezone, consent_channels and emailOptOut from the CRM. The CRM is the source: a value it does not store becomes null; owner_state or timezone that differ between the item and the CRM become null (kept as crm_conflicts so a later step does not refill them); consent channels are limited to those both allow; an email opt-out from either side wins. Local tests: a missing CRM timezone, quiet hours from the CRM timezone and no consent channel each block the send in all 15 sending steps.
- OPEN: needs Abdullah - (1) a Twenty credential for the disabled Twenty nodes and the tenant -> clientAccount map; (2) the new fields are empty on all existing records (no backfill), so in live mode sends stay blocked until they are filled.
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Inbound Receptionist (oJKV3Q9gxPmKV4j4), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Receive Inbound Calls; 1. Verify Caller Identity; 2. Answer Questions, Take Messages and Book; 3. Transfer Fallback When No One Answers; 4. After-Call Summary and Follow-Up Text. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 5 old separate workflows (Mkl9bjSupuXcUoC5, AVcrYJTCA4rvezxK, A3CY5KcuZvtpm5dw, np2PfzE1OjVsfCsl, eCbAsTj0pARLcFO4) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
