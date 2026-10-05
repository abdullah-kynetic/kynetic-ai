# Task 3.2: swap Emily's 13 Notion nodes for Twenty nodes

_Draft 2026-10-05. NOT APPROVED. Nothing in n8n or Twenty has been changed. Read-only pull of workflow `0PwP1tUf4478lNbf` (inactive, 40 nodes, v `4d866e51`)._

Twenty node: `@blackswampai/n8n-nodes-twentycrm`, credential "Twenty account" `41C04qbmnbi0GI2P`.
Client account (Kynetic Restoration (Demo)): `910ec9c7-9408-4aef-a9ff-ba3715e444da`. Replaces the Notion Client relation `3d6de1f1-...` on every node.

## The Notion nodes (14 found, docs say 13)

| # | Node (Notion today) | Flow | Twenty replacement |
|---|---|---|---|
| 1 | Create Contact - Emergency | Log Emergency | end_customers: find by phone, else create; set lastContact |
| 2 | Create Call - Emergency | Log Emergency | customer_interactions create, type EMERGENCY |
| 3 | Create Contact - Job Creation | Job Creation | end_customers: find by phone, else create; set lastContact |
| 4 | Create Job | Job Creation | client_jobs create |
| 5 | Create Call - Job Creation | Job Creation | customer_interactions create, type JOB_BOOKING |
| 6 | Create Contact - Inquiry | Log Inquiry | end_customers: find by phone, else create; set lastContact |
| 7 | Create Call - Inquiry | Log Inquiry | customer_interactions create, type INQUIRY |
| 8 | Get Jobs by Phone (Notion) | Job Query by Phone | end_customers find by phone, then client_jobs find by endCustomerId |
| 9 | Get Jobs by Phone (Tool) | Post-call agent | same two-step lookup, as an AI tool |
| 10 | Get Emergency Calls by Phone (Tool) | Post-call agent | customer_interactions find, endCustomerId + EMERGENCY |
| 11 | Get Inquiry Calls by Phone (Tool) | Post-call agent | customer_interactions find, endCustomerId + INQUIRY |
| 12 | Update Job (Tool) | Post-call agent | client_jobs update (bookingUrl, status) |
| 13 | Create Emergency Call (Tool) | Post-call agent | customer_interactions create, type EMERGENCY |
| 14* | Create Inquiry Call (Tool) | Post-call agent | customer_interactions create, type INQUIRY |

\* The workflow has 14 Notion nodes (8 regular + 6 tool), not 13. The docs count is off by one.

## Field mapping

**end_customers** (Notion Contacts): Name → `name`; Phone → `phones.primaryPhoneNumber` (+ country code +1); Email → `emails.primaryEmail`; Last Contact → `lastContact` (`$now`); Client → `clientAccountId`; Location → `location` (Job Creation only). Notes text has no field, drop it. `smsOptOut` already exists.

**client_jobs** (Notion Jobs): Job title → `name`; Service Type → `serviceType`; Location → `location`; Location Type → `locationType` (Residential/Commercial → RESIDENTIAL/COMMERCIAL, uppercase); Preferred Time → `preferredTime` (text, kept as-is); Booking URL → `bookingUrl.primaryLinkUrl`; Contact → `endCustomerId`; Client → `clientAccountId`.

**customer_interactions** (Notion Calls): Call title → `name`; Call Type → `interactionType`; Details → `summary`; Retell Call ID → `retellCallId`; (new) `channel` = VOICE; (new) `occurredAt` = `$now`; Contact → `endCustomerId`; Client → `clientAccountId`. Notion Status "Logged" has no field, drop it. Phone lives on the end customer, not the interaction.

## Decisions I need from you

1. **Job status.** Notion used New / Booked. Twenty client_jobs status only has SCHEDULED, IN_PROGRESS, COMPLETED, CANCELED. Booked → SCHEDULED is clear. For "New" (no appointment): (a) leave status empty, or (b) add a NEW option to the Twenty field (a Twenty schema change, needs your yes). I'd pick (b).
2. **Contacts: dedupe.** Notion created a new contact on every call. I'd do find-by-phone, then update lastContact or create. Adds one find node ahead of each of the 3 create-contact nodes, and it stops duplicate customers. OK?
3. **Post-call branch (nodes 9 to 14).** The sticky note says it is DISABLED, pending rebuild. Its Gemini model node (`Google Gemini Chat Model4`) has no model set. Options: (a) migrate it too so nothing Notion is left (my pick, but leave the branch's trigger path untested until we've reviewed it), or (b) leave it for later. Step 3.1 points Retell's post-call webhook here, so if we do (b), every call would hit a half-migrated branch.
4. **Job lookup response shape.** `Job Query by Phone` returns the first item of the last node to Retell (`responseMode: lastNode`). Notion pages and Twenty records look different. Before swapping I need to check what the live `get_jobs` tool and Nora's prompt expect, so the Twenty version returns the same keys. I'd add a small Set node to shape it.

## Not in scope, flagging only

- Twilio and Gmail nodes stay as they are. For testing, disable the two Twilio nodes and two Gmail nodes (or pin data), as the handoff says. Texts are filtered anyway until A2P is done (KI-003).
- The emergency SMS sends without checking `smsOptOut` (KI-002). Adding a check is a behavior change, so it's a separate decision after counsel.
- `Structured Output Parser` still says "AU prefix" for phone numbers, but this is a US number. It could mangle the destination of the booking SMS. Worth a fix in the same pass (your call).
- Twenty `client_accounts.retellAgentId` still holds Nora's agent id, not Emily's. Probably intentional while Nora is frozen, but I haven't changed it.

## Proposed sequence once approved

1. Decisions above, plus an approval of this plan.
2. Duplicate the workflow version for rollback (n8n history already keeps `4d866e51`).
3. Replace nodes in place, one flow at a time (inquiry, emergency, job creation, job query, post-call), keeping node names, webhook paths and connections.
4. Test each flow with a webhook payload, Twilio and Gmail disabled, and check the records in Twenty.
5. Re-enable the send nodes and leave the workflow inactive. Activation and step 3.1 (repoint) come after.
