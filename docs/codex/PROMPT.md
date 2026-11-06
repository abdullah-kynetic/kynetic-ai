# Current completion-work prompt

Read AGENTS.md, [COMPLETION-PLAN.md](COMPLETION-PLAN.md) and [PROGRESS.md](PROGRESS.md) first. The ten-step plan is the sole active checklist. [PROGRESS-HISTORY.md](PROGRESS-HISTORY.md) retains old check IDs, failures, approvals and outcomes; old done ticks are not new acceptance.

Work on the existing authorized dev/codex-setup branch and preserve unrelated changes. Reuse built components; identify missing implementation versus missing verification. Start with the lowest incomplete dependency allowed by the current request. Scope concrete acceptance and local, DEV and approved external gates before making changes. Documentation cleanup alone authorizes no implementation or provider test.

Existing scripts/checks/run.sh arguments still address historical steps 0–12. Explicitly map them to new acceptance; do not assume the same numeral means the new step. Run only authorized relevant checks, fix without weakening assertions, and stop after three consecutive failures on the same check: record the blocker, commit/push and wait. Do not reset counters by renaming steps.

Record actual revision/environment/date/results with evidence; note SKIPs and never invent test runs. Commit small complete changes as abdullah-kynetic <abdullah@kyneticai.com>, author and committer, without AI/coauthor trailers; push without force. No PR/main merge or production deployment unless separately instructed. Keep .github/ and unrelated portal/ work untouched.

Preserve all AGENTS safety restrictions: DEV/stub/synthetic defaults, outbound disabled, verified sessions, server consent/quiet-hours/opt-outs/kills, manual agency calls/DM tracking and per-deal pricing. Calls/SMS require explicit yes, TEST_PHONE and dedicated DEV agent/number; email recipients separately approved. Twenty requires exact dry run/approval, no DELETE or protected Demo changes. No protected/live agent or existing workflow changes/activation, DNS, Stripe live or production action without specific approval. No secrets printed/committed. Stage moves alone must not send, book, invite or charge.

VPS/config/service/DEV URL work: finish authorized work, push, provide one committed Mac script with commands starting git pull, stop and wait for Abdullah's output, then validate and record its provenance. Original step-6 live test and original step-9.2 send remain independent approval gates under new step 9.

Current consolidation handoff: finish the baseline audit before proposing implementation. Follow the conflict register rather than silently adopting historical open-mode, n8n-only consent, pricing, cadence or deployment instructions.
