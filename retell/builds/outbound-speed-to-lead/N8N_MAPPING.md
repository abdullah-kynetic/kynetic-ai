# n8n mapping: Source Template 05 -> our stack

**Status (Oct 8, 2026): applied in a NEW workflow.** "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`, inactive, never run) implements this mapping on Twenty + Retell + Gmail. The imported template `KYQIVtxwDcXVKmk3` is untouched. Deviations from the table: the post call webhook uses an unguessable path instead of header auth (Retell signs with x-retell-signature; revisit in 3.6/KI-005); the duplicate check runs before the lead is created, and a rejected submission is logged with leadStatus DISQUALIFIED. Unverified until a test run: Twenty REST filter syntax in "Check Recent Duplicate" and "Find Leads Due for Retry", and whether the Twenty create node returns `id` at the top level.

Audit of every node in SOURCE TEMPLATE 05 ("n8n Facebook Ad Form", the SolarShift pipeline on Vapi) and what each becomes in our outbound workflow. Credentials and IDs in the template belong to its author and must not be carried over.

## Our stack
- CRM: Twenty (node `@blackswampai/n8n-nodes-twentycrm`, credential "Twenty account" `41C04qbmnbi0GI2P`). Never Google Sheets, never Notion (D-006).
- Voice: Retell API over HTTP Request (header auth credential "Retell API (outbound)" to be created by Abdullah). Never Vapi.
- Calendar: Cal.com through the native Retell tools. Never Google Calendar.
- LLM, if any: OpenRouter through credential **"OpenRouter abdublitz"** (`hbKKePpm5LghGFFU`). Never Azure OpenAI, never Gemini nodes.
- Email alerts: Gmail credential "Abdullah Kynetic account" (`dil4wMogas9aOWKP`).
- SMS: none in v1 (A2P not registered).

## Node by node

| Template node | Type | Template backend | Becomes | Notes |
|---|---|---|---|---|
| New Form Submitted | Form Trigger | n8n | Keep, new fields + consent checkbox | See FORM_SPEC.md. |
| Create Lead | Google Sheets append | Google Sheets (author's OAuth, sheet "Facebook Ads Lead Storage") | Twenty: find endCustomer by phone, create or update | Store consent text, timestamp, source, formSubmittedAt. |
| Switch1 | Switch (under $100, not homeowner) | n8n | Light gate (IF nodes): phone valid, no duplicate in 24 hours, consent true | Per D-014. Template's solar rules (bill size, homeowner) are not in the gate; the agent confirms ownership on the call. |
| Find Lead / Delete Lead / Remove Lead / Get Lead | Google Sheets get/delete | Google Sheets | **Removed.** Twenty update sets leadStatus instead | Never delete a lead: we keep consent evidence. |
| Format Phone Number | Code | JS | Keep the idea, rewrite | Template throws on under 10 digits and returns items without `json`. Ours returns `[{json:{...}}]`, validates US E.164 and routes invalid numbers to Twenty, not an error. |
| Place Call | HTTP POST api.vapi.ai/call | Vapi bearer "Vapi Default Private Key", author's assistantId and phoneNumberId | HTTP POST `https://api.retellai.com/v2/create-phone-call` | Body: from_number, to_number, override_agent_id, retell_llm_dynamic_variables (first_name, company_name, agent_name, service_type, lead_source, owns_property, issue_type, timeline), metadata {twenty_id}. Credential "Retell API (outbound)". |
| Wait 30 Seconds1 / Fetch Call Details1 / In Progress-Ended?1 | Wait + HTTP + Switch loop | Vapi polling | **Removed** (D-012) | Replaced by the post call webhook. |
| End of Call Analyzer | LangChain Agent | Azure OpenAI (gpt-4.1-nano, "Azure Open AI" credential) | **Removed in v1** | Retell native post call analysis gives the outcome (D-012). If a fallback classifier is ever needed: OpenRouter chat model with credential "OpenRouter abdublitz". |
| Azure OpenAI Chat Model1 | LLM sub-node | Azure | **Removed** | Same. |
| Proceed or Not? | Switch (empty conditions in the upload) | n8n | Replaced by a Switch on `call_analysis.custom_analysis_data.outcome` | Template's switch does nothing as uploaded. |
| Create Opportunity | Google Sheets update (status Opportunity) | Google Sheets | Twenty: update endCustomer leadStatus, create customerInteraction (Speed to Lead, retellCallId, summary, outcome) | Do NOT create a Twenty opportunity: that object is Kynetic's own sales pipeline. |

## New nodes we add
1. **Post call webhook** (Webhook, POST, header auth) -> IF `event == call_analyzed` -> read outcome -> Twenty writes (D-014).
2. **Retry sweeper** (Schedule Trigger every few minutes): leads with outcome in (no_answer, voicemail), attempts < 4, nextAttemptAt <= now, inside allowed calling hours -> create-phone-call again (5 minutes, 1 hour, next day; D-012).
3. **Error alert** (Gmail to abdullah@kyneticai.com) on any failed call create or Twenty write.
4. **Dedupe/consent gate** as above.

## LLM check result
The only LLM in the template is the Azure OpenAI End of Call Analyzer, and v1 removes it. So the v1 workflow has no LLM node. Nothing routes outside OpenRouter because nothing calls a model. Retell's own post call analysis uses Retell's models.

## Things in the template that must not survive
- Google Sheets credential `aakodir833@gmail.com` and the sheet ID.
- Azure OpenAI credential.
- Vapi bearer credential, assistantId `f3878cf8-...`, phoneNumberId `983993c0-...`.
- The "never mention AI" line in the SolarShift prompt (D-011).
