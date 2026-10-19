# ElevenLabs build map: Alex outbound speed-to-lead

Status (2026-10-19, later): the n8n workflow is built as an inactive draft: `11Labs | Outbound Speed to Lead` (`xlmyRd5jBBBu8LX7`, 35 nodes, same folder as the Retell one, renamed `Retell | Outbound Speed to Lead` `tXJwNTkNgKGnp0Ab`). Never run. Still to do before any test: pick Twenty API / templated ElevenLabs / Gmail credentials, fill the agent ID and phone number ID placeholders (Call Settings, Retry Call Settings, Finished Call For Our Agent?), import a Twilio number into ElevenLabs, set the post-call webhook URL in ElevenLabs. Nothing else in n8n, Twenty or Retell was changed (only the Retell workflow's name). Per `providers/TEST_PLAN.md`, no n8n plumbing is built until ElevenLabs wins the bake-off. This map shows what the build would look like so the swap is a known quantity (scorecard item 13, n8n integration effort).

Baseline it swaps against: `retell/builds/outbound-speed-to-lead/` (BUILD_PLAN.md, N8N_MAPPING.md, FORM_SPEC.md). Same flow, different voice layer.

## 1. Architecture

```
Lead form (n8n Form Trigger, consent checkbox)               [unchanged]
  -> normalize phone (E.164), consent + dedupe + hours gate  [unchanged]
  -> Twenty: create/find endCustomer, store consent          [unchanged]
  -> PLACE CALL: ElevenLabs outbound API                     [CHANGED: was Retell create-phone-call]
        |
        v
  ElevenLabs agent "Alex" (prompt, voice, system tools)
        |-- check_availability  -> Cal.com slots             [native Cal.com tool or custom webhook tool]
        |-- book_appointment    -> Cal.com bookings          [same]
        |-- send_confirmation_sms -> Twilio Messages API     [NEW: text instead of email]
        |-- end_call / voicemail_detection (system tools)
        v
  POST-CALL WEBHOOK (signed) -> n8n                          [CHANGED: new payload + signature check]
  -> read analysis.data_collection (outcome, booked_slot, callback_time, notes)
  -> Twenty: customerInteraction + endCustomer update        [unchanged logic, new field paths]
  -> retry sweeper (no_answer / voicemail, 5 min, 1 hr, next day)   [unchanged]
  -> Gmail alert on any failure                              [unchanged]
```

## 2. Component by component

| Piece | Retell today | ElevenLabs version | Effort | Status |
|---|---|---|---|---|
| Agent | `agent_71e3...` prod, `agent_423a...` Alex Lab | `agent_9301m52zy185e609f8vyws4r1r7q` (test agent) | done | Configured 2026-10-16, see RESULTS.md |
| Place call | HTTP POST `/v2/create-phone-call`, `retell_llm_dynamic_variables`, metadata `{twenty_id}` | POST `/v1/convai/twilio/outbound-call` (or SIP trunk equivalent) with agent id, agent phone number id, `to_number`, `conversation_initiation_client_data.dynamic_variables`; Twenty id passed as a dynamic variable | 1 node | Endpoint name unverified, docs blocked |
| Phone number | Retell number | Import a Twilio number into ElevenLabs. None attached today. | Abdullah: Twilio account + number | Blocked on Twilio, KI-003 |
| Dynamic variables | first_name, company_name, agent_name, service_type, lead_source, owns_property, issue_type, timeline, email | Same names, set as placeholders + overridden per call. Add `twenty_id`. | trivial | Placeholders set |
| Booking | Native Cal.com tools | Native Cal.com tools, or my custom webhook tools (current) | test | See section 4 |
| Confirmation | Cal.com email | Text via `send_confirmation_sms` | new tool + Twilio | Stub first, real send needs KI-003 |
| Voicemail | hang up | `voicemail_detection` system tool (set, empty message) + Twilio answering-machine detection event | done | Untested live |
| Post-call data | `call_analysis.custom_analysis_data` | `analysis.data_collection_results` (outcome, callback_time, booked_slot, notes) | rewrite 1 node | Fields set |
| Post-call webhook | `call_analyzed`, `x-retell-signature` | `post_call_transcription`, `elevenlabs-signature` HMAC; also `call_initiation_failure` | 1 webhook + signature verify | Not configured (`post_call_webhook_id` null) |
| Retry sweeper | scheduled n8n | unchanged | 0 | |
| Twenty writes | per Retell fields | same fields, new JSON paths | small | |

## 3. Data mapping (Twenty)

| Twenty field | Source in ElevenLabs payload |
|---|---|
| customerInteraction.outcome | `data.analysis.data_collection_results.outcome.value` |
| customerInteraction.bookedSlot | `...booked_slot.value` |
| customerInteraction.callbackTime | `...callback_time.value` |
| customerInteraction.summary | `data.analysis.transcript_summary` |
| customerInteraction call id (today `retellCallId`) | `data.conversation_id` (needs a field rename or a new `callId` field: decide if we win) |
| endCustomer.leadStatus, lastOutcome, attemptCount, nextAttemptAt | derived from outcome, same rules as D-012 |
| lead lookup | `data.conversation_initiation_client_data.dynamic_variables.twenty_id` |

Payload paths are from search results of the ElevenLabs docs, not read in full: verify against a real webhook delivery.

## 4. Open design decisions

1. **Cal.com tools: native vs custom.** Native is less to maintain. Custom (current) lets me send the phone number and the property address. Plan: test native against event type 7520336; keep custom booking if native cannot send a phone number.
2. **Cal.com event type.** Test copy 7520336 (phone required, email optional). Production event 7404470 stays for Retell until a decision. If ElevenLabs wins, either migrate the shared event to the phone-required setup or keep one event per provider.
3. **Text confirmation content.** Name, day and time, address, a callback number, and the Cal.com reschedule/cancel link (text has no calendar invite). Needs a consent line covering texts on the form (D-007).
4. **Texting path.** Webhook tool to Twilio now (works the same on every provider). n8n sending the text after the webhook is the fallback.
5. **Twilio and SMS registration (KI-003).** Blocks real calls and real texts. Until then, calls are dashboard tests only and the text tool is a stub that logs content.
6. **LLM.** Currently `deepseek-v41-flash`. Test a stronger model as a second agent variant (clone through the JSON export).
7. **Workspace MCP.** `can_use_mcp_servers` is false. Leave off unless a use appears.

## 5. Phases

| Phase | What | Needs |
|---|---|---|
| A. Agent hardening (now) | text-confirmation prompt, availability window, silence timeout, remove language detection, stub SMS tool, point tools at 7520336 | Abdullah's go |
| B. Test | simulated conversations (booking mocked), live dashboard calls, one real booking, native Cal.com side test | Creator plan (Free tier has 15 min) |
| C. Bake-off rounds | 10+ voice, 10+ prefilled, edge cases, score vs Retell Alex Lab | B done |
| D. Decision | scorecard + cost from billing; log in `docs/decisions.md` | C done |
| E. Wire (only if it wins) | Twilio number import, post-call webhook, n8n place-call + webhook + sweeper changes, Twenty field path changes, real SMS | KI-003, Abdullah approval for each n8n/Twenty change |

## 6. Rules that stay in force
No changes to Retell, n8n, Twenty, production Alex, Nora, Emily or Kynetic Restoration (Demo) from this track. Secrets stay in ElevenLabs secrets or environment variables, never in the repo. Test bookings are cancelled only after Abdullah says so.

## 7. Unverified
Outbound endpoint name and body, post-call payload paths, native Cal.com tool parameters (phone support), Twilio text delivery, answering-machine detection payload.
