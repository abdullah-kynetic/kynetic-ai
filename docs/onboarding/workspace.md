# Workspace setup and ownership

The repository is the implementation record; Twenty is the business system of
record. Do not infer real account state from seed rows or create/update Twenty as
part of this documentation procedure. Any new Twenty operation needs an exact dry
run and Abdullah's yes; never DELETE or touch Kynetic Restoration (Demo).

## Isolated development workspace

Use `dev/codex-setup` and `https://dev.kyneticai.com`. The dedicated Compose project
is `kynetic-dev-portal`, its app binds only to loopback port 3031, and its Postgres
volume is separate from the live portal. Keep PROVIDER_MODE=stub,
OUTBOUND_ENABLED=false, ELEVENLABS_LIVE_ENABLED=false and DEV_PERSONA_SWITCHING=false.
The synthetic seed guard must pass before using the database. No production URL,
container, database, Caddy site, deploy user or live Alex belongs in this workspace.

Use the names-only [dev env example](../../crm/.env.dev.example). Inject credentials
at runtime; do not paste keys, phone values, populated env files, tokens or private
logs into docs/Git/chat. App, auth, worker, backup and migration roles have separate
permissions. Keep users invite-only, verify server-side sessions and retain tenant
RLS; do not enable persona switching to bypass sign-in.

## Integration inventory

Record resource IDs/ownership, not secrets, in `docs/codex/dev-resources.json`.
Only the Blitz DEV agent and dedicated DEV number are eligible for a later approved
TEST_PHONE call. No provider credentials are attached to the new notification
workflow stubs. Keep every `DEV - ...` n8n workflow inactive and each send node
disabled; a successful import is not approval to activate it.

The lead route `/api/hooks/leads/dev/:tenantKey` uses raw-body HMAC-SHA256 over
`timestamp.rawBody`, with X-Kynetic-Timestamp (Unix seconds) and
X-Kynetic-Signature (`sha256=` plus hex). Timestamp freshness is five minutes;
source/external IDs deduplicate events. Keep project type/budget in protected
activity data; queues carry identifiers. The server's consent directory and
OutboundGate are authoritative; a client-provided gate snapshot is not a send permit.

## Client-specific setup before later launch

Confirm legal entity, eligibility, hours/time zone, service area, calendar owner,
approved consent/recording wording, roles and exception handling. Store an approved
proposal/agreement/invoice reference and test evidence in the appropriate workspace.
Do not decide the future Kynetic-as-tenant model, alert channel, dialer, DM scope or
agency Stripe pricing here. Those product defaults remain open in steps 7–12.

Follow [checklist](checklist.md) and the staged [walkthrough](walkthrough.md).
The current automation ends with one DEV deploy handoff and waits for output;
step-6 live testing, production changes and agency work require separate approval.
