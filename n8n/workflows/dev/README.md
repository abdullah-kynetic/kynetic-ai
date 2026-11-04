# Inactive DEV workflows

`DEV - ElevenLabs Speed to Lead` is created in the connected self-hosted n8n instance,
DEV tagged and inactive. Its HTTP dispatch node is also disabled. Only manual synthetic
input is accepted; it prepares the ElevenLabs outbound-call request without executing it.
`elevenlabs-prepare.js` is the source embedded verbatim into the JSON Code node.

The request preserves `project_type` and `budget`, permits missing email, and ignores
any submitted destination. Destination comes only from `TEST_PHONE`; missing/invalid
configuration fails closed. FL/OK business states and non-synthetic inputs are refused.
No HTTP node retries call placement automatically. Successful/error/manual execution
persistence is disabled to avoid storing test payloads.

Before any execution, configure TEST_PHONE, DEV_ELEVENLABS_AGENT_ID and
DEV_ELEVENLABS_PHONE_NUMBER_ID in n8n's permitted runtime environment. IDs are recorded
in `docs/codex/dev-resources.json`; no secret or phone value belongs in workflow JSON.
A new n8n credential for Blitz must be selected before a dispatch node can run; no
provider credential is attached in this inactive synthetic build.

Step 3 must integrate the portal's verified consent, quiet-hours, kill-switch,
state eligibility and durable retry/idempotency decisions. Do not enable the HTTP node
or activate the workflow to work around those gates. Cal.com is currently verified by
read-only API access; bookings and confirmations remain synthetic until that chain is
implemented and explicitly authorized. Nothing claims that a real booking succeeded.

No server configuration/restart is performed in step 2. If runtime environment or dev
portal deployment changes are needed later, push and use the required Mac handoff.
