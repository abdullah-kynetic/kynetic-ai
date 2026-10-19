# n8n credentials inventory

Names and types of the credentials on n8n cloud as of 2026-10-18, and which saved workflows use them. **No secret values are stored anywhere in git.** n8n cannot export them, and they are lost when the cloud plan ends, so each one has to be recreated on the self-hosted instance from the original key or a fresh sign-in (OAuth ones need a new redirect URI: `https://n8n.kyneticai.com/rest/oauth2-credential/callback`).

| Credential name | Type | Used by (saved workflows) |
|---|---|---|
| AWS account | aws | none found |
| Abdullah Kynetic account | gmailOAuth2 | #8 Invoice Follow Up - Summit Ridge Roofing Demo; #9 Inbox Triage - Brightline Media Demo; Emily Restoration Speed to Lead; Kynetic CRM Email (Gmail via n8n); Nora Restoration AI Receptionist; Outbound Speed to Lead; Outbound Speed to Lead (Vapi); Porchlight Card: Ad Intake Form; Porchlight Card: Payment Received; Porchlight Card: Send Payment Link; VAPI COPY - do not use (was Outbound Speed to Lead (Retell)) |
| Airtable Personal Access Token account | airtableTokenApi | My workflow 7 |
| Cal.com Vapi | httpBearerAuth | Outbound Speed to Lead (Vapi); VAPI COPY - do not use (was Outbound Speed to Lead (Retell)) |
| ClickUp OAuth2 API | clickUpOAuth2Api | none found |
| Header Auth account | httpHeaderAuth | Kynetic CRM Email (Gmail via n8n) |
| Header Auth account 2 | httpHeaderAuth | Kynetic — Lead Scrape (Apify → Notion Outreach) |
| Kynetic AI Abdullah Cal | googleCalendarOAuth2Api | DEMO HVAC Receptionist Riley; HVAC - Inbound Voice AI Agent; backup hvac automation |
| Kynetic AI Google Sheets | googleSheetsOAuth2Api | ARCHIVE - SolarShift template (n8n Facebook Ad Form); DEMO HVAC Receptionist Riley; Great Clips AI Receptionist; HVAC - Inbound Voice AI Agent; Investor Data Consolidation; Setup - Investor Test Data; backup hvac automation |
| KyneticAI | apifyOAuth2Api | My workflow 7 |
| Notion account | notionOAuth2Api | Emily Restoration Speed to Lead; Kynetic Restoration — Inbound SMS Opt-Out Handler; Kynetic — Appointment Setter; Kynetic — Lead Scrape (Apify → Notion Outreach); Kynetic — Missed-Call Text-Back; Kynetic — Reactivation Reply Handler; Kynetic — Reactivation Sender; Kynetic — Review Request + Response + Referral Chain; Nora Restoration AI Receptionist; Pap Products — WhatsApp Lead Capture; Porchlight Card: Ad Intake Form; Porchlight Card: Payment Received; Porchlight Card: Send Payment Link; TEMPLATE — Client Config Lookup; WF — Seekers Approval Handler; WF — Seekers Youth Staff Bot |
| Notion account 2 | notionApi | Porchlight Card: Ad Intake Form; WF — Seekers Youth Staff Bot |
| OpenAi account | openAiApi | #9 Inbox Triage - Brightline Media Demo; 5 AI Agents; EMAIL ASSISTANT AGENT; HUMAN IN THE LOOP AI SALES AGENT; INVOICING PARSING AGENT; RAG AGENT |
| OpenRouter abdublitz | openRouterApi | Research Agent |
| OpenRouter account | openRouterApi | AI Analysis; DEMO HVAC Receptionist Riley; Dental Receptionist; HVAC - Inbound Voice AI Agent; My workflow 3; My workflow 4; My workflow 5; Pap Products - Telegram Inbound Agent; Pap Products — WhatsApp Lead Capture; WF — Seekers Youth Staff Bot; backup hvac automation |
| Retell API (outbound) | httpHeaderAuth | Outbound Speed to Lead |
| Supabase account | supabaseApi | 5 AI Agents; AI Analysis; My workflow 5; RAG AGENT; Research Agent |
| Twenty account | twentyApi | Kynetic CRM -> Twenty Sync; Outbound Speed to Lead; Outbound Speed to Lead (Vapi); Pap Products - Telegram Inbound Agent; VAPI COPY - do not use (was Outbound Speed to Lead (Retell)) |
| Twilio account | twilioApi | Emily Restoration Speed to Lead; Kynetic Restoration — Inbound SMS Opt-Out Handler; Kynetic — Appointment Setter; Kynetic — Missed-Call Text-Back; Kynetic — Reactivation Reply Handler; Kynetic — Reactivation Sender; Kynetic — Review Request + Response + Referral Chain; N8N / Retell / Twillio / Trade Receptionist; Nora Restoration AI Receptionist |
| Vapi API (outbound) | httpHeaderAuth | Outbound Speed to Lead (Vapi); VAPI COPY - do not use (was Outbound Speed to Lead (Retell)) |
| Vapi webhook secret | httpHeaderAuth | Outbound Speed to Lead (Vapi); VAPI COPY - do not use (was Outbound Speed to Lead (Retell)) |
| WhatsApp OAuth account | whatsAppTriggerApi | none found |
| n8n openrouter | openRouterApi | Kynetic — Reactivation Reply Handler; Porchlight Card: Ad Intake Form |
| pap Demo | whatsAppApi | Pap Products — WhatsApp Lead Capture |
| pap Demo | whatsAppTriggerApi | Pap Products — WhatsApp Lead Capture |
| pap demo | telegramApi | #9 Inbox Triage - Brightline Media Demo; Pap Products - Telegram Inbound Agent |
| seekers staff demo | telegramApi | 5 AI Agents; EMAIL ASSISTANT AGENT; WF — Seekers Approval Handler; WF — Seekers Youth Staff Bot |

Needed first for the live outbound workflow: `Retell API (outbound)` (Header Auth), `Twenty account` (Twenty API, point at https://crm.kyneticai.com), `Abdullah Kynetic account` (Gmail OAuth2). The `Gateway credits` Google AI credential used by Nora is n8n-cloud-managed and does not exist on self-hosted; Nora needs its own Google AI key or another model credential.
