# Kynetic Restoration (DEMO) — build IDs

_System A of the Pillar 5 build. Rebrand of Chrome Water Damage Experts (Austin TX). Demo alias only._

## Retell
- Agent ID: `agent_4c34644a04c74e27253e80167b`
- LLM ID: `llm_d19efe92627f50e48657788b9ff5`
- Knowledge base: `knowledge_base_aa1ce49a5c66293f` ("Kynetic Restoration (Chrome DEMO)") — ATTACHED to LLM
- Phone number: none (deferred — web-widget testing)
- Original template snapshot: `retell/builds/_inflate-original/`

## n8n
- Workflow ID: `2PFWFqBM0wabADk6` (being converted in place to System A)
- Instance: `https://abdullah-kyneticai.app.n8n.cloud`
- Webhook path UUIDs (unchanged from template):
  - get-jobs (Job Query by Phone): `881e3b34-7867-473a-a819-bc56c662a3af`
  - create-job (Job Creation): `9dfc3c1d-9d99-4041-9cae-3a60cc86652d`
  - log-inquiry (Log Inquiry): `56d89e8d-66c3-42bb-ae33-2c78e5d10caa`
  - log-emergency (Log Emergency): `e5563a13-1323-4109-ae88-5e87b8d48d3c`
  - post-call-analysis (Post-call Analysis): `596d4180-8295-497c-84f9-4481ed0ab8d3`
- Notion credential: `pPuCuC18ekEbAfp0` ("Notion account")
- Twilio credential: `aoIjAKkkoPR85aOq` ("Twilio account")

## Notion (data layer)
- Clients row (Kynetic Restoration): `3d6de1f1-a268-818b-a345-f245d3e768e6`
- Clients DB / data source: `7cf8a160-6d13-43aa-99f1-c8e78f3efbec` / `addfe75f-d7a5-4041-aac9-062130ebc800`
- Contacts DB / data source: `ab554e24-f46f-47fe-aab1-3d121823e0a8` / `6439f30c-a34f-4c10-a9c7-a7ec5794d74e`
- Jobs DB / data source: `29a4af8d-cbd0-4fd9-abfb-4d3c1edc6b94` / `3f97b782-6f54-433c-9cab-74c65e9c9631`
- Calls DB / data source: `3f2ad560-8a67-42c9-b9bc-ab348d8de6fb` / `f859d3a9-3532-49ef-bb2f-576f352301fc`

## Cal.com (booking)
- Account: abdullah@kyneticai.com (`abdullah-kyneticai`), key in `.env` as `CAL_API_KEY`
- Event type: **`7025524`** — "Water Damage Assessment" (slug `water-damage-assessment`), 60 min
- Schedule: `1181388` ("Bellaire Air Conditioning Hours" — Central time, M-F 7-5 / Sat-Sun 9-2)
- Booking URL: https://cal.com/abdullah-kyneticai/water-damage-assessment

## Hardcoded config values (for the n8n Client Config Set nodes)
- client_id: `3d6de1f1-a268-818b-a345-f245d3e768e6`
- client_name: `Kynetic Restoration`
- niche: `water damage restoration`
- notification_email: `abdullah@kyneticai.com`
- twilio_from: `[TWILIO_NUMBER_PENDING]`
- transfer_number: `+19084779490`
- timezone: `America/Chicago`
- agent_name: `Nora`
