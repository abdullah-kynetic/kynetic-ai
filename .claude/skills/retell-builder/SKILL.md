# Skill: Retell Voice Agent Builder

**Layer:** Agent (WAT Layer 2 — coordination)
**Workflow:** `workflows/retell-voice-agent-builder.md`
**Tool:** `tools/retell_builder.py`

---

## Trigger Signals

Invoke this skill when you see any of:
- "build a voice agent for [business]"
- "demo request" + any business name or niche
- "set up retell" / "create receptionist" / "configure the AI agent"
- "new client" + voice/phone/receptionist context
- Brand profile exists at `clients/[slug]/brand-profile.md` and has `voice_agent_config` fields populated

---

## Inputs to Collect

Before running anything, confirm you have these. Ask in one message — do not ask field by field.

**Required:**
- Business name
- Niche / what they do
- Phone number for emergency transfers (the owner/dispatcher's cell)
- Timezone (city is fine — infer IANA format)
- Business notification email
- n8n instance URL (`https://[name].app.n8n.cloud`)
- Google Sheet ID (must have Job, Emergency, Inquiry tabs already created)

**Optional (have fallbacks):**
- Cal.com API key + event type ID → if missing, remove scheduling tools
- AI receptionist name → default: Emily
- Sheet GIDs for Emergency and Inquiry tabs → if not provided, note that client must manually fix sheet references in n8n after import

**If brand-profile.md exists for this client:** read it first. The following fields map directly to inputs:
- `phone` → `transfer_number`
- `timezone` → `timezone`
- `services` → used to build services section in prompt
- `niche` → used for classifier lookup
- `email` → `notification_email`

---

## Execution Steps

### Step 1 — Classify
Read `retell/templates/business-classifier.md`.
Output one of:
- `DIRECT MATCH` — proceed as-is
- `ADAPTED MATCH: [niche]` — list the specific changes needed from the classifier

Tell the user the match result before proceeding. Give them a chance to correct if the classification is wrong.

### Step 2 — Generate Prompt
Build the `general_prompt` string using the base prompt from `retell/templates/base-agent-template.json`.

Substitute:
- Business name in the Role section and all greetings
- Timezone in the `{{current_time_TIMEZONE}}` Retell variable (use IANA format, e.g. `America/Chicago`)
- Services: write a concise 3–5 item list of what the business actually does
- Emergency keywords: niche-specific phrases a caller would use in a real emergency
- Example conversations: rewrite all 3 examples using the client's actual service types

For **adapted match** niches: apply the structural changes from the classifier before writing the prompt. Do not leave plumbing/HVAC references if this is a dental practice.

### Step 3 — Build Variable Map
Assemble the complete JSON variable map:

```json
{
  "BUSINESS_NAME": "...",
  "AGENT_FIRST_NAME": "Emily",
  "TIMEZONE": "America/Chicago",
  "TRANSFER_NUMBER": "+1...",
  "CAL_API_KEY": "cal_live_...",
  "CAL_EVENT_TYPE_ID": 12345,
  "N8N_EMERGENCY_URL": "placeholder",
  "N8N_INQUIRY_URL": "placeholder",
  "N8N_JOB_URL": "placeholder",
  "N8N_GETJOBS_URL": "placeholder",
  "N8N_POSTCALL_URL": "placeholder",
  "GENERAL_PROMPT": "...",
  "BEGIN_MESSAGE": "Hi, this is Emily from [Business], how can we help you today?",
  "GOOGLE_SHEET_ID": "...",
  "SHEET_GID_EMERGENCY": 11699001,
  "SHEET_GID_INQUIRY": 1470146104,
  "NOTIFICATION_EMAIL": "...",
  "n8n_instance_url": "https://..."
}
```

Note: `N8N_*_URL` values start as "placeholder" — they are replaced by `retell_builder.py` after the n8n workflow is imported and live webhook URLs are retrieved.

### Step 4 — Execute via Tool

Run the build using the Retell MCP and n8n MCP directly in sequence. `retell_builder.py` contains the orchestration logic and prints `__RETELL_MCP_EXEC__` and `__N8N_IMPORT__` signals — execute those steps using the respective MCP tools.

**Retell LLM creation** — use `mcp__retell-ai__execute`:
```typescript
async function run(client) {
  const llm = await client.llm.create({ ...llm_payload });
  return { llm_id: llm.llm_id };
}
```

**Retell Agent creation** — use `mcp__retell-ai__execute`:
```typescript
async function run(client) {
  const agent = await client.agent.create({ ...agent_payload });
  return { agent_id: agent.agent_id };
}
```

**n8n workflow import** — use `mcp__claude_ai_n8n__create_workflow_from_code` with the rendered `base-n8n-template.json` content as the workflow definition.

**Retrieve webhook URLs** — the 5 webhook path UUIDs are fixed in the template. Production URLs follow the pattern `{n8n_instance_url}/webhook/{path_uuid}`. Resolve all 5 immediately after import.

**Update Retell LLM tools** — use `mcp__retell-ai__execute` to patch the LLM with the real URLs:
```typescript
async function run(client) {
  await client.llm.update("llm_xxx", { general_tools: [...updated_tools] });
  return { ok: true };
}
```

**Update Retell Agent webhook_url** — use `mcp__retell-ai__execute`:
```typescript
async function run(client) {
  await client.agent.update("agent_xxx", { webhook_url: "https://...post_call_analysis_url" });
  return { ok: true };
}
```

### Step 5 — Verify
After all MCP calls succeed, run one verification:

```typescript
async function run(client) {
  const llm = await client.llm.retrieve("llm_xxx");
  const tools = llm.general_tools.filter(t => t.url);
  return tools.map(t => ({ name: t.name, url: t.url }));
}
```

Confirm every `url` field points to the client's n8n instance, not `inflate.app.n8n.cloud`.

### Step 6 — Deliver Summary
Output the summary card specified in `workflows/retell-voice-agent-builder.md` Step 5. Include all IDs, URLs, and the client's next steps.

---

## Error Handling

**Retell API shape changed:** Run `mcp__retell-ai__search_docs` with query "llm create" or "agent create" to get current field names before retrying.

**n8n credentials not connected:** Import succeeds but the workflow won't run until credentials are linked. Note this in the summary — it is not a blocker for creating the Retell agent.

**No Cal.com key:** Remove `check_availability_cal`, `book_appointment_cal` from the tools array before creating the LLM. Update the prompt's booking section to say the team will call back to confirm time. Keep `create_job_details` and `get_jobs` — job logging still works without Cal.com.

**No transfer number:** Remove `transfer_call` from tools. Update emergency section to log-and-notify only.

**Client doesn't have n8n yet:** Block. Note that n8n is required for the webhook automation layer. Offer to document what the client needs to set up, but do not build the Retell agent with dead webhook URLs.

---

## Output to Client Folder

After a successful build, save a record to the client's folder:

```
clients/[business-slug]/voice-agent.md
```

Content:
```markdown
# Voice Agent: [Business Name]

Built: [date]
Niche: [niche]
Match type: direct / adapted

## IDs
- Retell Agent ID: agent_xxx
- Retell LLM ID: llm_xxx
- n8n Workflow ID: xxx

## Webhooks
- Job creation: https://...
- Emergency: https://...
- Inquiry: https://...
- Job lookup: https://...
- Post-call analysis: https://...

## Next Steps
- [ ] Link phone number in Retell dashboard
- [ ] Add knowledge base (services, pricing, locations)
- [ ] Connect n8n credentials (Google Sheets, Gmail, Twilio, Gemini)
- [ ] Activate n8n workflow
- [ ] Test with a live call
```
