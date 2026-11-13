# Dedicated dev portal

> **Retired 2026-11-09 PST until after go-live.** Do not run `archive/dev-retired/scripts/deploy-dev.sh` or `archive/dev-retired/scripts/fix-dev-runtime.sh`. They refuse. The production target is the `main` build at portal.kyneticai.com, and only after an explicit yes. The rest of this file describes the stack that used to be deployed. It is not a setup procedure.

Historical procedure, withdrawn: from a Mac checkout on `dev/codex-setup`, run `bash archive/dev-retired/scripts/deploy-dev.sh` after pulling.
The script uses optional `DEV_DEPLOY_SSH_HOST`, `DEV_DEPLOY_SSH_USER` and
`DEV_DEPLOY_SSH_IDENTITY_FILE` selectors. Otherwise it prompts for the server (default
40.160.150.91), an admin user (default `ubuntu`, or `-` to use the SSH config user),
and an existing private key **file path** (blank uses SSH agent/config). SSH aliases
from the Mac's config are listed without reading any key contents. Never paste key
contents into a prompt or command. The admin account needs sudo; SSH requests a terminal.
Production `PORTAL_DEPLOY_*` credentials are deliberately not used: `portalnew-deploy`
and `deploy` are restricted production accounts and cannot run this installer.

Uncommitted Mac edits are neither deployed nor changed. The tracked revision is streamed over SSH into a private staging directory. The server
script runs as root, stores immutable releases under `/opt/kynetic-dev-portal/releases/`,
and keeps generated credentials outside the repository in
`/var/lib/kynetic-dev-portal/dev.env` (mode 600). Repeated deployments retain credentials
and data. It never invokes a production deploy script or changes a production database.

Compose project `kynetic-dev-portal` has its own PostgreSQL 17 container, network, roles
and persistent named volume. It bootstraps, migrates, seeds synthetic tenants and runs
the existing synthetic-only guard before starting the app. Port 3031 binds only to
loopback; an unrelated listener causes refusal. App provider mode is `stub`, outbound
is false, ElevenLabs live mode is false, and no provider credentials are forwarded.
The worker is defined but deliberately not started for the setup check.

Requires existing Docker Compose v2, Python 3, curl, flock, and host systemd Caddy.
No packages, firewall rules, DNS records, Cloudflare settings or production containers
are changed. The server appends a managed `dev.kyneticai.com` block to the existing
host Caddyfile, retaining all existing text. Automatic HTTPS uses Caddy's normal
certificate issuance; DNS must point to this server and HTTPS/ACME must be reachable.
An existing unmanaged dev route, edited managed route, nonstandard Caddy installation,
or concurrent Caddyfile edit causes refusal. Caddy validates before replacement and
reloads after the dev app is healthy; reload failure restores the previous config.
A Caddy reload applies the added dev route to the shared listener; it does not restart
Caddy or change the existing `portal.kyneticai.com` block.

Build/bootstrap diagnostics are redacted against generated credentials before being
written to a root-only log. The script prints only non-secret status messages.
A failed build leaves the previous app running. Failed initialization never starts the
app. A failed app health check leaves the existing Caddy routing unchanged; a failed
redeploy may require rerunning the prior revision to restore the dev app.

Success ends with `PASS 0.7 https://dev.kyneticai.com/ HTTP 200 (verified from Mac)`
and `DEPLOYED_REVISION=<40-character commit>`. The Mac follows the app's redirects,
matching the urllib behavior in check 0.7. Return these status lines to Codex as VPS
handoff evidence; Codex must not claim that its network-restricted executor reached
this host. No step is marked complete until that evidence arrives.

## Step 3 auth handoff

The deploy now verifies `/sign-in` returns 200 and anonymous `/admin` returns 401,
without redirects, before writing the server's deployed-revision marker. The Mac repeats
those checks against dev HTTPS and prints `PASS DEV_AUTH` plus `DEPLOYED_REVISION`.
An older open-mode image returning 403 or a redirect is not sufficient for this handoff.
Send the output back to Codex with "done" before step 3 continues. Outbound remains
false, live ElevenLabs remains false, persona switching remains false, and providers
remain stubbed. No call, SMS, Twenty write, workflow activation or production change
is part of this script.

### Step 3 deployment and gate verification

Withdrawn 2026-11-09 PST: do not pull `dev/codex-setup` and do not run `bash archive/dev-retired/scripts/deploy-dev.sh`. The older step3-dev-handoff.sh is a compatibility alias and also refuses.
The script deploys the dedicated dev stack and always opts into the manual `verify` Compose
profile. Its one-shot tools container checks runtime isolation, requires a database
containing only allowed synthetic tenants, and tests the deployed consent, quiet-hours
and global/tenant kill-switch code under the worker role/RLS. Temporary contact,
consent, activity and tenant-switch changes are always rolled back. The fixture has
no phone and only a reserved example.test email; no provider adapters, calls, SMS,
email delivery, Twenty operations or dispatch workers run in this verifier.

The tenant-switch case uses a test-only function argument to reach that switch;
the deployed environment's `OUTBOUND_ENABLED` remains false throughout. A consenting
daytime control is also checked so the quiet-hours case cannot pass merely because
all requests are denied. This verifies gate decisions, not a real send, signed intake
through a running worker, Cal.com booking or remote n8n workflow synchronization.

Success includes `PASS DEV_STEP3_GATES ... provider requests 0`, public auth checks,
`DEPLOYED_REVISION`, and `PASS DEV_INTAKE_UNSIGNED HTTP 401`. No production deploy
helper is invoked. If any check fails, the script exits nonzero; private diagnostics
stay in the root-only dev deployment log. Send the printed summary to Codex, never
credentials or raw private logs.

### Repair the existing DEV runtime prerequisites

Withdrawn 2026-11-09 PST. Do not run `bash archive/dev-retired/scripts/fix-dev-runtime.sh`. The old repair, kept so the retired stack can be recognized, reused the deployed
portal revision: it does not rebuild the app image, migrate/seed the database, edit
Caddy/DNS, activate n8n or change any provider account. It recreates the DEV app with
the privately entered TEST_PHONE and starts a restricted worker from the deployed
tools image/source. It builds only tools targets for that worker and smoke checker.

The SSH TTY prompts for the operator's own TEST_PHONE in E.164 with input hidden.
Only the dedicated root-private dev.env stores the value; no number/key is placed
in Git, command arguments or printed output. The runtime override always fixes
providers to stub, outbound and live ElevenLabs off, and persona switching off.
Subsequent DEV deployments preserve this override and configured phone.

The restricted worker registers lead intake, event fanout and the sender-free DEV
attempt queue only. Normal voice/SMS/email dispatch, n8n callbacks, notifications
and backup jobs are not registered. A health marker is written only after startup.
The worker runs as UID 1001, and its job handlers use the existing runtime DB roles.

A smoke checker submits the same signed synthetic lead twice through the public
DEV hook, verifies accepted/duplicate, waits for asynchronous processing and a
future attempt deferred by the kill switch, and asserts no new call/message rows.
It may create a missing signing secret for the synthetic demo-a tenant, without
rotating an existing secret. Test contact/deal/consent/activity/job rows are retained
as clearly tagged DEV evidence; the consent text does not authorize real contact.
There is no Twenty write, calendar reservation, provider call/SMS or workflow
activation. It prints the unchanged portal revision and the runtime-helper revision.

This verifies a blocked synthetic worker path, not a live test. Calendar tools and
any real send still require separate preparation and explicit owner approval.
