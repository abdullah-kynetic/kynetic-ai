# Step 6 walkthrough and approval gate

Status: cloud/synthetic preparation only. This run stops before the full live test.
Completing this page, a local build or a DEV deployment does not authorize any call,
SMS, email, additional Twenty write, workflow activation or production operation.
Agency steps 7+ also wait for Abdullah's separate yes after step 6 passes.

## 1. Cloud acceptance evidence

Read [progress](../codex/PROGRESS.md) and the [onboarding checklist](checklist.md).
Run from the repository root with Bun available:

```bash
scripts/checks/run.sh 3
scripts/checks/run.sh 4
scripts/checks/run.sh 5
scripts/checks/run.sh 6
```

Expected: no FAIL for any step. Step 6.3 MUST remain MANUAL/SKIP until Abdullah
explicitly approves the live test. This is a gate, not permission inferred from
"continue" during the cloud build. Checks 3.4 and 4.3 are read-only provider GETs;
other acceptance work uses synthetic data and local/stub providers.

Evidence includes signed intake/deduplication, consent/quiet-hours/global+tenant
kill blocking, delayed retries/transaction rollback, native simulated booking with
open/closed-slot coverage, inactive notification previews and the four previously
approved synthetic Twenty writes. No further Twenty write is authorized by those
old test IDs or by rerunning a dry-run tool. The repo workflows are stubs; gate
snapshots in input are not server-side send permits.

## 2. ONE final DEV deployment

After cloud steps 3–5 pass and step-6 preparation passes, push dev/codex-setup.
From the Mac checkout at ~/kynetic-ai, pull the branch and run
`bash scripts/deploy-dev.sh`. The script enforces that branch, uploads committed
files only and deploys the dedicated dev portal/database at dev.kyneticai.com.
It retains stub providers, outbound disabled, persona switching disabled and
loopback port 3031; it does not invoke a production deploy helper or start n8n.

Required output: isolated synthetic DB guard, healthy app, sign-in 200, anonymous
admin 401 without redirects, rollback-only consent/quiet/kill verifier with zero
provider requests, final public DEV root 200, unsigned DEV intake 401 and exact
DEPLOYED_REVISION. On error, stop and report the printed safe summary; private logs
can contain operational details and must not be pasted without review/redaction.

Reply done with the output. Codex records it as user-supplied VPS evidence,
reruns available cloud safety checks, and reports PASS/FAIL and remaining unknowns.
No fallback to the production portal and no secret values belong in the handoff.

## 3. STOP — live test requires a separate explicit yes

Before requesting approval, prepare a precise one-attempt plan: which pinned DEV
ElevenLabs agent and dedicated DEV number, TEST_PHONE destination from environment,
consent basis, proposed lead-local time and current quiet-hour/kill state, intended
booking action and expected records. Keep outbound disabled until that exact test
is approved. Do not include a number or credential value in the plan.

A yes for a call does not approve SMS, calendar reservations/confirmation email,
Twenty writes, activation, DNS or a production deploy. Get exact-operation approval
for each additional effect. No uncertain dial is automatically repeated. If a
request times out, reconcile read-only before any retry. If TEST_PHONE is missing
or a gate denies, do not contact anyone. Never touch live Alex, AM-1 Roofing or
Kynetic Restoration (Demo).

The live test remains NOT RUN. Actual remote n8n import/credentials, live provider
behavior, real calendar booking and production readiness are not certified by
stub checks. Record owner approval and actual evidence before marking step 6 done.
