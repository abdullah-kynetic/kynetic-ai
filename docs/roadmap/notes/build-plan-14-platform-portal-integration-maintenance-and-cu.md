# BUILD PLAN 14: Platform, portal integration, maintenance and custom services

_Twenty note `e24420db`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Platform, portal integration, internal maintenance, custom services
*Pointer: main note "SYSTEMS INDEX". Service family: Platform & Engagement Services. n8n folder: Kynetic AI / Platform Ops. Updated 2026-11-09. Source: GitHub spec sections 7, 9, 10, 11 (abdullah-kynetic/kynetic-ai, branch claude/project-thread-kj2v2h, docs/systems/portal.md, platform-maintenance.md, custom.md).*

**For the building LLM (reads only Twenty and n8n):** everything here is a PROPOSAL until verified. Build only net-new workflows, INACTIVE, tagged DEV, no real credentials/sends; follow "N8N ORGANIZATION GUIDE". Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno).

Only part A (maintenance) and the error-alert piece of the platform make sense as n8n workflows. Parts B and C are mostly scope/discovery definitions: do NOT invent workflows for them.

## A. Internal platform maintenance (spec 9)
**Outcome:** keep the shared automation estate secure, reliable and supportable. Bounded managed operations, not unlimited development or guaranteed uptime.

**Today:** EXISTING backups (Twenty nightly 02:00 to /var/backups/twenty + R2 kynetic-twenty-backups; read-only n8n backup tool), security/a11y reviews, CI on crm/ changes. PARTIAL: VPS DEV workflows `ijQVSulzSU5HeQp5` (error-alert) and `cYHVXD1blenqvalE` (owner-alert), both inactive (not movable by MCP until MCP access is enabled). UNKNOWN: n8n VPS version/edition, execution mode, persistence.

**Included categories:** inspect n8n execution failures, queue age, credential expiry, provider webhooks; Twenty/API/DB health, backup success and restore drills (non-destructive); usage/tenant caps and suspicious spend; dependency patching in staging with rollback; credential rotation via approved secret systems; workflow/template version compatibility; provider vs Twenty reconciliation and dead letters with policy recheck; suppression/audit integrity and log redaction; runbooks and monthly service report. Excluded unless scoped: new features, new niches/channels, major migrations, client reports, content/ad management, on-site, 24/7 response.

```text
scheduled check / telemetry alert -> classify severity & tenant impact
-> known safe remediation in staging -> test -> approved deployment window
-> verify business health -> close with audit
unknown/high-risk -> pause affected net-new automation if authorized -> human escalation
backup alert -> inspect -> synthetic restore drill in isolated environment -> evidence
```
Paused automation must never stop opt-out ingestion or safety controls.

**Proposed n8n workflows (folder Platform Ops, DEV copies in Sandbox (DEV)):** `platform-error-alert` (shared error workflow: tenant, system, correlation id, attempt, sanitized code, owner), `platform-health-check`, `platform-backup-drill-check`, `platform-credential-expiry`, `platform-reconcile-deadletter`. Display name: "Platform | <function>".

**Events/metrics:** `maintenance.incident_detected`, `maintenance.change_verified`, `maintenance.restore_tested`, `maintenance.credential_expiring`; availability by agreed measurement, MTTA/MTTR, execution success, queue age, restore-test success, overdue patches, recurring incidents. Maintenance is not evidence of client revenue.

| Client portal UI | Internal operator portal | Headless backend |
|---|---|---|
| own-tenant status, scheduled notices, resolved summaries | cross-tenant assigned health, sanitized errors, queue/retry detail, versions, audit | health checks, backup monitors, reconciliation, safe release orchestration, metering |
| client cannot restart n8n, run workflows or restore DB | operator commands need MFA/RBAC, reason, allowlist, audit | no arbitrary command execution or secret echo |

**Requirements/tests:** R-PLT-01 failed workflows produce an actionable alert (T-PLT-01); R-PLT-02 restore drill in isolated environment with evidence (T-PLT-02); R-PLT-03 no workflow auto-activates after deploy/restore, paused automation never stops opt-out ingestion (T-PLT-03); R-PLT-04 operator commands allowlisted, RBAC, audited, client cannot invoke (T-PLT-04). Sandbox acceptance: synthetic error classified; retry uses current policy; client cannot invoke operator action; expired test credential alert; backup drill evidence without exposing data; no Twenty delete.

## B. Standard shared portal integration (spec 7, 10)
One shared base portal, not one per system. UI presents state and safe commands; n8n orchestrates headlessly; Twenty stores operational facts; providers run under protected credentials. Portal writes are idempotent controlled commands, never direct edits of coordination state; the backend derives tenant from session and returns "accepted" not "done" until a durable acknowledgment. Browser never holds provider tokens or n8n credentials. Portal session is not an n8n credential.

**Base components:** home/outcomes (data freshness, caveated metrics); inbox/handoffs; pipeline/appointments; journeys (state, next step, suppression reason); settings (hours, service area, approved config via validated forms); usage (minutes, SMS segments, caps); audit/support.

**RBAC (proposed):** platform admin (cross-tenant health only, audited); operator (assigned tenants, retry/pause/release); tenant owner (own data, config, pause, resolve handoffs); sales (assigned leads, disposition, takeover); front desk (conversations, callbacks, reschedule/cancel via controlled flow); marketing (campaign/attribution; publishing separately gated); viewer. Transcripts/recordings separately permissioned and redacted in lists.

**Illustrative contracts (none implemented):** GET tenant/systems/{system}/summary; GET tenant/handoffs/{id}; POST tenant/systems/{system}/pause; POST tenant/conversations/{id}/takeover; POST tenant/appointments/{id}/reschedule; POST internal/commands/{id}/ack.

**Current state:** portal exists with an n8n contract (lead intake webhook with HMAC, portal-to-n8n events lead.created, deal.stage_changed, call.completed). CONFLICT: Twenty is the Kynetic operational record vs portal's own Postgres contacts (default D-S02: Twenty is Kynetic record). CONFLICT: portal sign-in was removed in open mode vs later commits restoring it; live state unverified. Bespoke client portal is separately scoped and never a dependency for core n8n execution.

**Requirements/tests:** R-POR-01 automation works with portal down, projection failures retry independently (T-POR-01); R-POR-02 controlled idempotent commands, tenant from session (T-POR-02); R-POR-03 server-side RBAC (T-POR-03); R-POR-04 versioned JSON-schema contracts before UI work (T-POR-04).

## C. Custom AI, back-office automation, full transformation, on-site (spec 11)
Broad service categories needing discovery, NOT fixed products. No workflows to build.
- **Custom AI:** each recipe names owner, task boundary, source corpus, deterministic tools vs suggestions, confidence/human review, evaluation set, audit/caps. No autonomous contract, discount, hiring, safety-critical, legal or financial representation.
- **Back-office:** each recipe names trigger, authoritative input/output, field mapping, reviewer, failure recovery, audit, access, metrics, tests. Payments/accounting stay human-approved. No Google Drive/Docs/Sheets for Kynetic.
- **Full transformation:** discovery, prioritization, data foundation, pilot workstreams, change management, controlled rollout, stabilization, continuous backlog; each bounded by an SOW.
- **On-site:** separately scoped; remote-first pilot is the default; no production activation implied.
Requirements: R-CUS-01 recipe names owner/corpus/tools/evals/caps (T-CUS-01); R-CUS-02 HITL on high-risk (T-CUS-02); R-CUS-03 bounded workstreams (T-CUS-03). Priced scope intentionally absent.

## n8n placement and naming
- Folder: **Kynetic AI / Platform Ops**. Sandbox copies: **Kynetic AI / Sandbox (DEV)**, named "DEV - platform | <function>", tagged DEV, INACTIVE, error workflow set, no execution data saved.

## Open gaps
- n8n Community lacks external secrets/environments; deployment-level controls to inventory.
- Whether portal or Twenty is authoritative for Kynetic records (D-S02 default: Twenty).

## Built so far (2026-11-09)

Built 2026-11-09 by Scout (batch B). First niche: all types of remodelers. Every workflow below is a template: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). Status of every workflow: locally tested, unproven in n8n (the saved node code was run in a local harness on fake data: 555-010x numbers, invalid.example emails; no n8n test run is possible right now). Live copies: none.

Scope: plan 14 part A (internal maintenance) only.

- Template - Remodeling - Platform Health Checks - Daily Health Check | n8n id uhvNJWpOpT7KT0WM | plan workflow platform-health-check | sends nothing | local tests 5/5 passed: all ok -> healthy; R-PLT-03 unexpected active workflow -> high; T-PLT-01 synthetic failures classified; unknown telemetry is not ok; no telemetry source -> human_review. Unproven in n8n.
- Template - Remodeling - Platform Health Checks - Backup and Restore Drill Check | n8n id xCtsIbYdaPnQgxJJ | plan workflow platform-backup-drill-check | sends nothing | local tests 3/3 passed: fresh backup + isolated drill -> healthy, evidence redacted; stale backup -> high; T-PLT-02 drill not isolated -> refused high. Unproven in n8n.
- Template - Remodeling - Platform Health Checks - Credential Expiry Check | n8n id N0mNS7NBONmE9gsQ | plan workflow platform-credential-expiry | sends nothing | local tests 3/3 passed: expired test credential -> alert, secret dropped; expiring in 5 days -> warn; no expiry date -> human_review. Unproven in n8n.
- Template - Remodeling - Platform Health Checks - Retry Failed Messages Safely | n8n id 5gEqgtSVtVbuVSyl | plan workflow platform-reconcile-deadletter | sends only through Template - Remodeling - Shared - Message Safety Check and Send (MOqT97N0ItVyKIno) | local tests 5/5 passed: retry passes current policy, same idempotency key; contact opted out since failure -> suppressed on retry; provider and Twenty disagree -> both shown; max attempts -> person; missing flags -> human_review. Unproven in n8n.
- Error alert already exists and was NOT rebuilt: Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx). Parts B (portal integration) and C (custom services) have no workflows, per this plan.
- Read-only: these checks never restart, activate, deactivate or restore anything (auto_remediation false). An active workflow not on the allow list (only WxIh0Hw4lQodY1Xa Website | Contact Form to Twenty) is flagged high for a person.
- OPEN: needs Abdullah - read-only telemetry source for n8n/Twenty status, execution failures, queue age and provider webhooks (not built; with no input the check goes to human_review).
- OPEN: needs Abdullah - read-only credential metadata source and approved secret system for rotation. Secret values in the input are dropped and never echoed.
- OPEN: needs Abdullah - restore drill environment (must be isolated) and evidence format (only row counts and checksums are kept). This workflow never runs a restore.
- Retry Failed Messages Safely re-runs the CURRENT contact rules through the shared safety check with the contact current flags and the ORIGINAL idempotency key; provider vs Twenty disagreement is shown with both values and not resolved automatically; max 3 attempts.
- OPEN: needs Abdullah - where per-client (tenant) settings live and who edits them (default: hardcoded template config labeled tenant_config: OPEN: needs Abdullah).
- OPEN: needs Abdullah - wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow for these templates (proposal only, not done).
- OPEN: needs Abdullah - signed webhook verification is not built; any input that arrives by webhook goes to human_review (reason webhook_signature_check_not_built).
- OPEN: D-S06 - where duplicate checks, leases and tokens are stored durably (default: input only, nothing stored).
- 2026-11-09 contact lookup (Scout): Template - Remodeling - Platform Health Checks - Retry Failed Messages Safely (5gEqgtSVtVbuVSyl) now call Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) with wait for completion on, right after 'When Executed by Another Workflow' (new nodes: Pick contact details for CRM lookup -> Look up contact and opt-out settings in CRM (shared, waits for result) -> Use CRM contact and opt-out settings; nothing else in the step changed, the Manual test path is unchanged). dnc, smsOptOut and callOptOut now come from the CRM record as stored; the most restrictive value wins and leadStatus DNC counts as dnc true. not_found, ambiguous_contact or a flag the CRM does not store -> null -> the step's own fail-closed check sends the item to human review. Locally tested, unproven in n8n (lookup tests 129/129 on code fetched back from n8n).
- Resolved 2026-11-09 (Abdullah approved adding what the templates need in Twenty): endCustomers now has doNotCall, emailOptOut, smsConsent, callConsent (BOOLEAN, unset = null), consentSource, ownerState (two-letter), timezone (IANA) (TEXT, unset = empty string). Consent capture time stays in the existing consentAt field. Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) reads doNotCall directly and also returns emailOptOut, owner_state, timezone and consent_channels (from smsConsent/callConsent).
- Resolved 2026-11-09 (evening, second pass): endCustomers now also has emailConsent (BOOLEAN, unset = null), and consent_channels includes 'email'. Every step's 'Use CRM contact and opt-out settings' node now also copies owner_state, timezone, consent_channels and emailOptOut from the CRM. The CRM is the source: a value it does not store becomes null; owner_state or timezone that differ between the item and the CRM become null (kept as crm_conflicts so a later step does not refill them); consent channels are limited to those both allow; an email opt-out from either side wins. Local tests: a missing CRM timezone, quiet hours from the CRM timezone and no consent channel each block the send in all 15 sending steps.
- OPEN: needs Abdullah - (1) a Twenty credential for the disabled Twenty nodes and the tenant -> clientAccount map; (2) the new fields are empty on all existing records (no backfill), so in live mode sends stay blocked until they are filled.
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Platform Health Checks (hQI9WmIdHytWBQOr), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Daily Health Check; 1. Credential Expiry Check; 2. Backup and Restore Drill Check; 3. Retry Failed Messages Safely. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 4 old separate workflows (uhvNJWpOpT7KT0WM, N0mNS7NBONmE9gsQ, xCtsIbYdaPnQgxJJ, 5gEqgtSVtVbuVSyl) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
- 2026-11-10 (Scout): new Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI), inactive, TEMPLATE, 0 credentials: MOqT97N0ItVyKIno's policy and sink code copied unchanged plus a 'When Executed by Another Workflow' trigger, because MOqT only has a Manual trigger and cannot be called. Every merged workflow and the Back-End Manager send through it. MOqT97N0ItVyKIno itself is untouched and still in Templates / Remodeling for Abdullah to decide on; the proposed MOqT diff is NOT applied. Shared tools kept separate: Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h), Error Alert (gTV1LEsH51TaytUx), Record Opt-Outs on Do-Not-Contact List (nYy2G48xRai2anwX).
