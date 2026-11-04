# Codex progress (steps 0–6)
Tick a step only when `scripts/checks/run.sh <n>` has no FAIL. Note SKIPs.

- [ ] 0 Dev setup
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
