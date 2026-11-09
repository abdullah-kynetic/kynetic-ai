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

## Step 4 notification stubs

The four `missed-call`, `reminder`, `owner-alert` and `error-alert` workflows are
inactive, manual synthetic rehearsals. They have now also been imported as NEW
DEV-tagged inactive objects; IDs and source hashes are recorded in
`docs/codex/dev-notification-resources.json`. Regenerate with
`python3 tools/build_dev_notification_workflows.py`. Code bodies come from
`notification-prepare.js`; no skill/reference contents were copied.

Missed-call textback requires an inbound no-answer/voicemail event. Confirmations
require a confirmed booking. Reminders additionally require explicit due/expiry
timestamps and are skipped outside that interval; no reminder lead time is invented.
Owner alerts cover client lead/qualified-call/confirmed-booking events. Error alerts
suppress self-recursion and never include raw error bodies, names, stacks or URLs.
Stable record/action keys support deduplication in the stub sink. No client contact
information is copied to output; recipient is the TEST_PHONE placeholder only.

A gate snapshot in synthetic input is merely a test fixture. It is **not** trusted
authorization. Missing/denied snapshots block preparation and quiet hours defer it.
All previews retain dispatch_enabled=false; the Twilio node is disabled with no
credentials and automatic retry off. Manual/success/error payload storage is off.
VM tests execute these exact Code bodies, including timing, deduplication and redaction.
The portal's existing server-side sendSms/OutboundGate remains the only real SMS path;
real delivery/activation is unverified and requires a separate explicit approval.
The create-only importer `tools/import_dev_notifications.py` is dry-run by default.
Its approved development application created only these four new stubs and assigned
the DEV tag to those new IDs; it has no activation/execution/delete operation. Existing
workflow definitions are never edited. Real delivery is still unconfigured and unauthorized.
