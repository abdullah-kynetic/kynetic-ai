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
- Needed: allow `dev.kyneticai.com` in this cloud environment's network configuration. Dev portal availability and database isolation remain unverified; no deployment or DNS changes were made.
- Remaining setup: deploy and tag the new inactive n8n workflow, then verify the isolated dev portal/database. The repository workflow is manual-only, has no send/provider nodes, and retains the literal `{{TEST_PHONE}}` placeholder. It does not send calls or texts. n8n node-schema tool returned an internal error; no remote workflow was created or changed.
- No live Alex changes, existing workflow changes, calls, texts, Twenty writes, or `.github/` edits.
