# Kynetic — current completion plan

Updated **2026-11-06**, America/Los_Angeles. This is the **one active completion checklist**, replacing old steps 0–12, milestone/wave execution order, and any proposed 13–22 numbering. Old IDs remain evidence references; they are not the new step numbers. This consolidation authorizes documentation only, not implementation, deployment or external tests.

## How to use this plan

Status vocabulary: **NOT ASSESSED** = insufficient review; **PARTIAL** = some implementation/evidence exists but acceptance is incomplete; **BLOCKED** = a named permission, dependency or external prerequisite prevents completion; **VERIFIED** = all scoped acceptance has dated, revision-bound evidence. An unchecked external gate cannot be relabeled VERIFIED because stub tests pass. Status applies to the whole step, with blocked sub-gates named separately.

Start with step 1's baseline evidence reconciliation before executing dependent work. Reuse existing implementation. Record source revision, environment, exact command/test, actual result, fixture/provider mode, evidence path and approval reference for each acceptance result. Keep local, deployed DEV and approved external outcomes separate. A historical done tick is a claim to reconcile, not proof of operational completeness. Do not calculate a completion percentage from these unequal steps.

Keep dev/codex-setup, small tested commits as abdullah-kynetic <abdullah@kyneticai.com>, no AI/coauthor trailers, no force push or main merge. Preserve the Mac-script VPS handoff and three-consecutive-failure stop rule. All existing safety rules remain binding; the conflict register below documents old wording without weakening it.

## Active checklist

- [ ] 1. Baseline audit — PARTIAL
- [ ] 2. Security/access — PARTIAL
- [ ] 3. Runtime/recovery — PARTIAL
- [ ] 4. Lead intake/safety — PARTIAL
- [ ] 5. Agency sales workflow — PARTIAL
- [ ] 6. Communications/booking — PARTIAL
- [ ] 7. Metrics/reporting — PARTIAL
- [ ] 8. Contracts/billing/delivery — PARTIAL
- [ ] 9. End-to-end acceptance — PARTIAL
- [ ] 10. Production release — BLOCKED

## 1. Baseline audit

**Status: PARTIAL. Scope/dependencies:** establish a revision-bound inventory of built, partial, missing and unverified behavior across client and agency sides before treating any old completion claim as current. No implementation dependency; source/evidence access required.

**Reuse:** crm/ source, migrations, native CRM models, old BUILD_PLAN task IDs, security/accessibility reviews, Codex history and resource/evidence JSON. The November 6 remaining-work report is preserved as a snapshot, not another active plan.

**Missing implementation:** none authorized by this audit. Identify actual gaps rather than replacing completed components. **Missing verification:** code-to-requirement mapping for every old done claim, reachability of referenced commits, exact test coverage and deployed configuration. The source review is not a new complete code/security audit.

**Acceptance/evidence:** reconcile the traceability tables below against source and historical evidence; classify each requirement; name stale/contradictory claims; distinguish real from stub integrations; account for all blockers and deferrals. Record the observed branch/revision and preserve unrelated untracked portal/ without interpreting it as deployed code. No numbered 13–22 plan was found in the inspected planning inventory; its proposed scope must still be carried through explicit requirements, not invented IDs.

**Gates:** local documentation/source inspection only now. Future read-only DEV observation must retain provenance. External/provider writes are not baseline evidence and are not authorized.

**Recorded baseline, not rerun in this cleanup:** implementation/audit 1eb4b8e; prior status synchronization c290951; report save f5ce33b; confirmed DEV c34b11aa359c933410bfec5522d9ced32cdc3e7e from Abdullah's Mac output. Historical local results: 527 unit PASS, three Chromium journeys PASS, 13 agency checks PASS/0 FAIL/two manual SKIP, build/typecheck/lint pass with existing warnings. Those results do not cover all requirements below. Latest UI remains unconfirmed on DEV; signed-runtime repair, worker readiness and external booking/delivery remain unverified.

## 2. Security/access

**Status: PARTIAL. Scope/dependencies:** authentication, 2FA, roles, tenant isolation, request signatures, safe secrets and privacy. Depends on step 1 inventory; protects every later step.

**Reuse:** verified signed-cookie/DB sessions, active-admin and view-as guards, Better Auth, RLS/tenant services, API rate limits, signed intake/provider hooks, encrypted native secret rotation, existing security tests/review.

**Missing implementation:** close any source-confirmed gaps in invitations/recovery, disabled-user sessions, webhook replay protection, redaction, audit coverage and credential least privilege. Do not reintroduce anonymous admin or client-persona fallback. Implement protected-ID guards in tooling if the historical audit finding remains reproducible; never exercise those tools against protected resources.

**Missing verification:** actual Abdullah/cofounder identities and roles; real sign-in/2FA/recovery; expiry/sign-out/revocation; owner/VA/view-as denial; cross-tenant A/B read/write/export/storage/job isolation; webhook raw-body signatures, stale timestamps, duplicates and wrong tenants; rotation invalidates old signatures without displaying secrets. Recheck KI-002/005/006/007/008/013 and the duplicate KI-013 labels by title/date rather than assuming the same issue.

**Acceptance/evidence:** anonymous admin 401/403; non-admin 403; verified active admin allowed; missing/invalid second factor denied; disabled/expired sessions denied. Cross-tenant tests must fail before mutation. Malformed/old/unsigned hooks fail; valid synthetic signatures pass once. Compare credential separation by safe assertions, never printing values. Record current dependency/security regression evidence separately from the Oct 29 review.

**Gates:** local synthetic tests first; actual DEV auth and role checks via Mac handoff when needed; invite/email delivery requires an approved recipient, and DNS/provider configuration needs specific approval. No live portal request/change is implied. Counsel and A2P readiness remain external prerequisites, not automatically resolved by server-side code.

## 3. Runtime/recovery

**Status: PARTIAL. Scope/dependencies:** isolated DEV deployment, worker/queue execution, schedules, migrations, storage, backups, restore and rollback. Depends on steps 1–2; services must be operational before provider tests.

**Reuse:** scripts/deploy-dev.sh and server helper; isolated kynetic-dev-portal database/volume and loopback 3031; Caddy DEV site; restricted sender-free runtime worker; pg-boss schedules; existing migration, backup and storage infrastructure.

**Missing implementation:** only source-confirmed gaps in release markers, worker health, dead-letter/retry visibility, recoverable jobs, backfill, retention and approved backup destinations. Do not rebuild deployment or change production routing.

**Missing verification:** newest UI revision on DEV; actual worker readiness and TEST_PHONE configuration without printing it; least-privilege DB roles; queue consumers; scheduled execution; migration compatibility; off-server database/object backups and an isolated restore; rollback safety. The historical missing TEST_PHONE/stopped-worker diagnostic has no newer clearance. A helper being prepared is not evidence it ran.

**Acceptance/evidence:** deploy requested revision to DEV only; health/auth/gate markers and unchanged production evidence; synthetic durable job goes queued→running→completed; restart/crash recovery and duplicate suppression; observe schedules in Pacific time including DST; failed job does not stall others. Restore database plus objects into an isolated target, verify counts/tenant isolation, test rollback/migration recovery. Document RPO/RTO from actual exercises rather than inventing targets or outcomes.

**Gates:** local disposable database and fake storage first. VPS deploy/restart/configuration/DEV URL checking requires push, one committed Mac script, stop and wait for output. Keep providers stubbed/outbound off, persona switching off and all DEV workflows inactive. Production backup/restore changes and DNS are separate approvals. Never equate app health with worker health.

## 4. Lead intake/safety

**Status: PARTIAL. Scope/dependencies:** signed source intake, normalization, attribution capture, deduplication, consent, local business/quiet hours, opt-outs, frequency/attempt caps, retries and global/tenant kills. Depends on steps 2–3.

**Reuse:** crm/src/app/api/hooks/leads/, crm/src/server/leads/, crm/src/server/consent/, outbound gate, durable webhook jobs, chain unit/integration tests, signed DEV smoke helper and rollback gate verifier.

**Missing implementation:** assess source-specific form/Meta/Angi/LSA mappings, post-call result/failure normalization, reusable authenticated n8n gate reads, parity and per-attempt audit. Preserve UTM/source/campaign identifiers end to end. Resolve retry-policy contradictions before configuring cadence. Keep server-side consent and fresh final-boundary checks even if n8n orchestrates.

**Missing verification:** valid signed DEV intake, exactly one contact/deal under duplicate/replayed events, async processing/restart, zero provider requests on denied gates, quiet-hours future scheduling, opt-out cancellation of pending work, cross-tenant secret denial and live-config-independent clock tests. Existing Mac gates/unsigned rejection do not prove this full journey. Existing approved synthetic Twenty evidence does not prove continuous writeback.

**Acceptance/evidence:** table-driven invalid input, unsupported FL/OK, protected recipient/AM-1, missing consent, opt-out/STOP, global/tenant kill, quiet/business-hour edges/DST, caps and retry exhaustion; prove no sink invocation when blocked. A valid synthetic signed lead persists before any dispatch; replay creates no extra attempt/contact/deal. Booking/reply/opt-out/closure prevent retries. Verify stale delayed jobs recheck gates and uncertain outcomes reconcile before retry.

**Gates:** fake clocks/providers and local synthetic DB first; signed DEV-only smoke via Mac when requested; keep outbound disabled. Real call/SMS requires separate explicit yes and TEST_PHONE through the dedicated DEV agent/number. Twenty writes require exact dry run and yes. Do Not Call registry lookup remains deferred; internal do-not-contact and all other safety rules remain required. No emergency bypass may silently override an opt-out.
