---
type: object
cluster: lead
universe: live
status: verified
entity: n8n/workflows/active/outbound-speed-to-lead__m2YJwZ1l8DTzyEkw.json
verified_on: 2026-10-22
verified_at: cbb5046 (source files unchanged since 67763e6)
---

# Outbound Speed to Lead (n8n)

The form-to-call-to-CRM workflow. The repo copy is the **cloud** workflow (38 nodes, active in the backup). Abdullah says the VPS copy (`tXJwNTkNgKGnp0Ab`, inactive when read) is canonical; it is not in the repo.

## Why this shape
Twenty is the CRM and Retell is the voice platform, so the workflow only moves data between form, Twenty, Retell and Gmail alerts. No LLM node.

## Shape (from the JSON)
- Path 1: Form Trigger -> Normalize Lead -> Check Recent Duplicate (Twenty) -> Light Gate -> Create Lead -> Resolve Lead Timezone -> calling-hours gate (8:00-21:00 lead local) -> Call Settings -> Place Retell Call (`POST api.retellai.com/v2/create-phone-call`) -> Mark Lead Calling. Out of hours: Queue Lead for Morning Call.
- Path 2: Retell Post Call Webhook (POST, `authentication: none`, long random path) -> analyzed-event checks -> Fetch Call From Retell -> Normalize Call Result -> Log Call Interaction + Update Lead After Call -> optional 90 s fast retry.
- Path 3: Retry Sweeper every 5 minutes -> Find Leads Due for Retry -> window check -> Retry Call Settings -> Place Retry Call.
- Agent id and from-number are literal values in **two** Set nodes: Call Settings and Retry Call Settings.
- Credentials: "Twenty account", "Retell API (outbound)", Gmail "Abdullah Kynetic account". Two draft SMS nodes are disabled.

## Connected to
- **joins:** [[alex-agent]], Twenty `endCustomer` / `customerInteraction`, Cal.com via the agent's native tools.
- **looks-like-but-is-not:** template `KYQIVtxwDcXVKmk3` (do not run), the Vapi copies, the VPS 11Labs variant `xlmyRd5jBBBu8LX7` (not in repo).

## If you change this
- **Hits:** change agent id or from-number in both Set nodes; `N8N_MAPPING.md` and `BUILD_PLAN.md` text; node counts in `KYNETIC_CONTEXT.md`; `n8n/manifest.json` bucket; the Twenty field names used in the JSON bodies (`leadStatus`, `nextAttemptAt`, `attemptCount`, `retellCallId`).
- **Does not hit:** Nora's workflow, the portal.
- **Outside the tree:** which n8n instance is live; the Retell agent's post-call webhook URL points at this workflow's path.

## See
- `n8n/workflows/active/outbound-speed-to-lead__m2YJwZ1l8DTzyEkw.json`, `retell/builds/outbound-speed-to-lead/N8N_MAPPING.md` (header is stale, see docs/plans/AUDIT.md)
