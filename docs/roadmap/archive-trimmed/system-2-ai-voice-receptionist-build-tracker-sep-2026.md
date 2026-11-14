# [LATER, parked per ROADMAP 7bfdcb7e] [P2] System 2 — AI Voice Receptionist Build Tracker (Sep 2026)

_Twenty note `4b681f14`, created 2026-09-24, updated 2026-11-09. Exported 2026-11-12._

Sole build tracker for System 2 (AI Speed to Lead Agent) on the demo business, Kynetic Restoration. Carried over from Notion (last edited Sep 22, 2026). Open items are tracked as Tasks linked to the Kynetic Restoration (Demo) client account.

## Scope split
Phase A is strictly what Inflate's original reference template did: answer the call, qualify it (service, location, urgency), book via Cal.com, log it. Phase B is everything built on top of that. Confirmed by Abdullah on Sep 22: if it wasn't in Inflate's build, it's Phase B, no exceptions.

Standing caution: a finished Phase A system is fine for demos and audit calls, but is not legally safe to send real SMS to real customers until Phase B's compliance items are done.

## Live verified state (Sep 22, 2026)
**Retell.** Agent `agent_4c34644a04c74e27253e80167b`, named "Nora - Kynetic Restoration Voice Receptionist." LLM `llm_d19efe92627f50e48657788b9ff5` has a fully rewritten prompt and begin message for Kynetic Restoration. All 5 tool webhooks and the post-call webhook point to `abdullah-kyneticai.app.n8n.cloud`. Cal.com tools use event type `7025524` (Water Damage Assessment, 60 min, on-site), timezone America/Chicago. Transfer number +1 908-477-9490. Knowledge base `knowledge_base_aa1ce49a5c66293f` attached. **Still unpublished**, blocked only on the voice decision.

**n8n.** Workflow `2PFWFqBM0wabADk6`, renamed "Kynetic Restoration — System 2 Voice Receptionist." Active, 40 nodes, Notion-backed.

**Twilio.** Both SMS confirmation nodes wired to +16692660586 (owned, active, not trial). Live send test on Sep 22 was accepted by Twilio (SID SM67163dbb59d8245bad5e3b1f3b7afbbd) but never arrived. Cause: A2P 10DLC registration incomplete. This blocks real SMS delivery in end to end testing.

**Local files.** `retell/builds/kynetic-restoration/Kynetic Restoration.md` holds all live IDs, webhooks, the variable map, and open items.

## Phase A — Inflate parity
1. Done: repoint all 5 tool URLs (Log Emergency, Job Creation, Log Inquiry, Job Query by Phone, Post-call Analysis).
2. Done: rewrite system prompt for Kynetic Restoration (removed in-store vs on-site branching).
3. Done: qualification flow asks service type, address, urgency.
4. Done: Cal.com key and event type 7025524 wired in.
5. Done: transfer_call set to +1 908-477-9490.
6. Done: agent renamed Nora.
7. **Open:** pick the voice on purpose (currently generic 11labs-Cimo). Only blocker on publish.
8. Done: correct knowledge base attached.
9. **Blocked on 7:** publish the agent.
10. **Blocked on 9 and A2P:** test booking, emergency, and inquiry paths end to end. Confirm Cal booking still works with location_type removed.
11. **Blocked on 10:** confirm post-call webhook fires and AI Agent4 logs via its 6 Notion tools.
12. **Blocked on 10:** confirm test calls appear in n8n execution log.
13. Done: n8n workflow renamed from Pillar 5 to System 2.
14. **Blocked on 12:** archive the 11 old test rows in Notion Contacts/Jobs/Calls.
15. Done: local build folder recreated.

## Phase B — built on top
**Compliance:** turn on Inbound SMS Opt-Out Handler; fix missing Contact relation on Create Emergency Call / Create Inquiry Call (needs a Contact lookup/create tool on AI Agent4); get TCPA language in front of retained counsel before any paying client goes live.
**Text channel (not started):** website chat widget workflow, ad form workflow, build and embed the widget, pick model tier and test.
**Quoting and Estimate Automation (not started):** scope trigger, inputs, output; build in n8n after job qualification.
**Insurance Claim Documentation & Submission (not started):** scope photos/notes, scope of work, claim paperwork, adjuster tracking; build as its own workflow after job completion.
**Make it repeatable:** extract into the bracketed [CLIENT] token template (System B); write the "Add a Client" fill-in guide.

## Decisions locked
- Architecture: hardcoded demo workflow plus [BRACKET] template, no runtime Client Config Lookup. Template made by whole-file find/replace.
- Demo business: Kynetic Restoration (water damage, Austin TX, America/Chicago), rebrand of Chrome Water Damage Experts.
- Booking: Cal.com live booking on Abdullah's account.
- TCPA/SMS: consent gate on emergency SMS, STOP/HELP footer, opt-out suppression, upsert by phone, inbound STOP handler. Built, tracked as Phase B. 8am to 9pm send window excluded from scope (still open).
- Contact dedup: search by phone then update or create on all 3 branches.
- n8n structure: single canvas.
- Retell API key stays in .mcp.json.
- Persona: Nora. Notification email: abdullah@kyneticai.com.
- AI model: OpenRouter, gemini-2.5-flash-lite on 4 drafting agents, gemini-2.5-flash on the post-call agent.

## Bugs found and fixed (none shipped)
1. Wrong Notion ID type (collection vs database ID) on Create Job and 3 Create Call nodes.
2. Invalid OpenRouter model slug.
3. Client/Contact relation index swap on 3 Create Call nodes.
4. Draft vs published version desync in n8n. Lesson: republish after every batch of changes.
5. AI Agent4 transcript mapping hit the sandbox block on the token `arguments`; switched to JSON.stringify(item).
6. create_job_details location_type was required with a stale description; removed as required.
7. book_appointment_cal had a leftover hardcoded location_type; deleted, needs confirming on first live test call.
