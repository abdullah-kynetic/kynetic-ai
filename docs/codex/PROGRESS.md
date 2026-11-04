# Codex progress (steps 0–6)
Tick a step only when `scripts/checks/run.sh <n>` has no FAIL. Note SKIPs.

- [x] 0 Dev setup
- [ ] 1 Foundation
- [ ] 2 Alex on ElevenLabs
- [ ] 3 Lead→booking chain
- [ ] 4 Texts & alerts
- [ ] 5 Onboarding
- [ ] 6 Go-live (full test needs Abdullah's yes)

## Blockers
### Step 0 blocked — 2026-11-04
- Check `0.7` failed three consecutive runs of `scripts/checks/run.sh 0` with `HTTP 0`. Direct diagnosis through the configured proxy returned `Tunnel connection failed: 403 Forbidden`. `DEV_PORTAL_URL` points at `dev.kyneticai.com`, which is absent from the enforced network allowlist. No bypass attempted.
- Attempt 1: added names-only `crm/.env.dev.example` and inactive `DEV - Setup Safety Check` repository workflow. Checks 0.1–0.5 passed; 0.6 initially found no DEV agent; 0.7 failed.
- Attempt 2: created only a new `DEV-Alex Codex Setup` on Blitz (ID in `dev-resources.json`), without tools or an attached number. Checks 0.1–0.6 passed; 0.7 failed. Confirmed dev and production hosts differ.
- Attempt 3: reran after diagnosing proxy denial; checks 0.1–0.6 passed, 0.7 failed. Final total: 6 PASS, 1 FAIL, 0 SKIP. Stopped per AGENTS.md rule 12; step remains unchecked.
- Needed: allow `dev.kyneticai.com` in this cloud environment's HTTP network configuration and permit SSH TCP access to the host selected by `PORTAL_DEPLOY_HOST` on port 22. Dev portal availability and database isolation remain unverified; no deployment or DNS changes were made.
- Remaining setup: deploy and tag the new inactive n8n workflow, then verify the isolated dev portal/database. The repository workflow is manual-only, has no send/provider nodes, and retains the literal `{{TEST_PHONE}}` placeholder. It does not send calls or texts. n8n node-schema tool returned an internal error; no remote workflow was created or changed.
- No live Alex changes, existing workflow changes, calls, texts, Twenty writes, or `.github/` edits.

### Step 0 resume investigation — 2026-11-04
- Abdullah authorized an isolated VPS dev deployment at `dev.kyneticai.com`, separate service/port/database, and sequential steps 0–6 with commits and pushes. DNS A record is reported added. Existing live portal must remain untouched.
- Rechecked current environment readiness: deploy credentials are configured, but the enforced HTTP allowlist still excludes `dev.kyneticai.com`; HTTPS through the inherited proxy still returns `Tunnel connection failed: 403 Forbidden`.
- Attempted SSH transport through the configured `tcp_connect_proxy` from `/etc/codex/network-policy.json`: connection to that proxy fails with `ConnectionRefusedError`. The policy has zero TCP domain grants and zero TCP IP-range grants. No direct route, proxy bypass, alternate destination, or policy-file modification attempted.
- Available cloud environment tools expose status and diagnostics, not network configuration changes. Adding a DNS record or possessing an SSH key does not change this executor's outbound permissions.
- The original three failures of 0.7 remain unresolved; no additional step-check retries were spent without a relevant fix. Step 0 remains blocked; steps 1–6 were not started. New authorization permits pushing the setup/blocker commits to `dev/codex-setup`.

### Step 0 VPS handoff prepared — 2026-11-04
- Working mode: Codex builds/tests/fixes here; Abdullah runs VPS operations from the Mac. Push before each VPS handoff and wait for output. VPS-only check results will be recorded as user-supplied evidence, not as locally observed HTTP results.
- Added `scripts/deploy-dev.sh`, its server helper, and `crm/deploy/dev/` configuration. Dedicated project `kynetic-dev-portal`, persistent PostgreSQL 17 volume, loopback port 3031, synthetic-only gate, stub providers, no outbound, new HTTPS dev site appended to the host Caddyfile. No production deploy helper is invoked; existing site blocks are preserved.
- Local validation passed: Bash syntax for both scripts; Docker Compose rendering and assertions for dedicated volume/port/provider isolation; Caddy candidate preservation/idempotency and refusal of duplicate or edited dev routes; generated credential redaction and log mode 600; `git diff --check`.
- Not run here: VPS deploy, Docker image build, migrations/seed, TLS issuance, or public dev HTTP check. Runtime deployment depends on the Mac handoff; step 0 remains unchecked. Check 0.7's three previous failures describe this executor's network restriction and are not new deployment attempts.
- Awaiting Mac output: `PASS 0.7 ... HTTP 200` plus `DEPLOYED_REVISION`. Then verify available checks here, record remote evidence for 0.7, and continue setup before step 1.

### Step 0 handoff correction — 2026-11-04
- Mac output confirmed the initial deployment script stopped at its clean-worktree guard before SSH; this is not a VPS check 0.7 failure.
- Removed that unnecessary guard. Uploads still use `git archive HEAD`; uncommitted Mac changes are preserved and excluded from the deployed payload. Branch restriction remains enforced.
- Validation: Bash syntax; isolated temporary Git checkout with a modified tracked file reaches a stubbed SSH command without changing the file; wrong branch still refuses before SSH. Awaiting deployment output; step 0 remains unchecked.

### Step 0 SSH account correction — 2026-11-04
- Mac SSH authentication as `portalnew-deploy` was denied before any remote command. Repository inspection confirms this is a restricted production forced-command account, not a suitable admin login for dev setup. Earlier advice to use it was incorrect.
- Dev deployment now uses separate optional `DEV_DEPLOY_SSH_*` selectors and prompts for an existing Mac key file path or normal SSH config/agent. Defaults are the documented server IP and admin account `ubuntu`; restricted production accounts are refused. No private key values are copied, displayed or transferred.
- Bash syntax and stubbed SSH tests passed for admin selection, key paths containing spaces, and production-account refusal. Awaiting Mac SSH/deploy output; no VPS deployment or 0.7 success claimed.

### Step 0 complete — 2026-11-04
- Mac handoff confirmed deployment of `7b21cd751f85c9d3d7a0d13ed2e0bcb6279d629d`: dedicated Postgres volume/synthetic guard, healthy loopback app at 3031, new HTTPS dev site, and final public HTTP 200. The initial TLS error recovered during the retry. Existing production site blocks were reported retained.
- Created only the new `DEV - Setup Safety Check` n8n workflow, DEV tagged and verified inactive. It is manual-only with no send nodes; its literal TEST_PHONE placeholder cannot contact anyone. Resource ID is recorded in `dev-resources.json`. The n8n connector returned an internal error, so provisioning used the documented REST endpoint with its env key.
- `scripts/checks/run.sh 0 --vps-evidence docs/codex/vps-evidence.json`: **7 PASS, 0 FAIL, 0 SKIP**. Checks 0.1–0.6 reran here; 0.7 explicitly used Abdullah's Mac output. Evidence is checked against the target URL, status, provenance, date, and deployed ancestor revision; ordinary checker invocation still performs HTTP normally.
- Evidence validation tests passed, including wrong-target, failure-status, missing-provenance/output, stale/future-date and unknown-revision rejection. Prior network blocker is resolved for this workflow by the authorized Mac handoff, not by changing network policy.
- Continuing to step 1 under Abdullah's instruction to proceed between steps.

### Step 1 local verification / Mac handoff — 2026-11-04
- Added `crm/tests/unit/kill-switch.test.ts`: global disable blocks calls/SMS/email before consent/config lookup; inbound-reply bypass cannot bypass the switch; tenant kill switch blocks before consent; clearing the switch does not bypass module protection. Existing gate behavior is unchanged.
- First `scripts/checks/run.sh 1` attempt: six PASS, two FAIL (1.1 stale `.next/types` referenced a removed auth route; 1.7 root/admin HTTP 0 due executor networking). The successful build regenerated Next route types.
- Second attempt: **seven PASS, one FAIL**. Passed 1.1 typecheck, 1.2 lint, 1.3 full unit tests, 1.4 production build, 1.5 safety logic, 1.6 all three focused safety suites, and 1.8 tracked-file secret scan. Only 1.7 remains pending Mac verification; it has failed twice here, with no live portal observations or changes.
- Added read-only `scripts/checks/mac-portal.sh` to request the live portal root and unauthenticated `/admin` from the Mac. No page contents, cookies, credentials, or server changes. It disables curl config, follows redirects as the Python check does, and prints only status codes. Stubbed tests confirm a denied admin passes, public admin fails, and an absent HTTP response fails. Native check also rejects an absent admin response instead of treating HTTP 0 as a successful block.
- Python evidence validation tests and Bash syntax passed. Step 1 remains unchecked until Mac output for 1.7 arrives. No redeployment is required for these test/check-only changes. If the live portal admin is public, do not change the live portal without Abdullah's explicit authorization.

### Step 1 blocked — check 1.7 third failure — 2026-11-04
- Abdullah ran `scripts/checks/mac-portal.sh` from the Mac after pulling `aacd2741`. Actual output: `CHECK 1.7 root HTTP 200; unauthenticated /admin HTTP 200`, followed by `FAIL 1.7 ... no server changes made`. Recorded as user-supplied evidence in `vps-evidence.json`; it is not a passing result.
- Failure history for 1.7: first local attempt HTTP 0/0 (network restriction), second local attempt HTTP 0/0, third attempt via authorized Mac handoff HTTP 200/200 (fails the specified non-200 admin criterion). Stop under AGENTS.md rule 12. No further retries; step 1 remains unchecked, steps 2–6 unstarted.
- The checker follows redirects, so final HTTP 200 alone cannot establish whether the response was an admin page or a sign-in page. Existing source uses open-persona mode and documents a requirement for network access control; live response bodies/redirects and edge configuration have not been inspected. No production auth or edge change was made.
- Next work requires explicit authorization for any live-portal fix, plus resolution of the three-failure stop. Keep the live portal, production database, live Alex, existing workflows, main and `.github/` unchanged pending that authorization.
- User subsequently pasted the illustrative `PASS ...` output as a command; zsh rejected it. Those shell errors are not a successful check and made no server changes.
- Seven other foundation checks remain passing from the second local run. No additional test run is needed for this evidence-only update.
