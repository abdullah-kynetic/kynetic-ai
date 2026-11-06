# Build inventory (Phase 1, read-only)

Date: 2026-11-06. Method: repo read, `docs/*` read, n8n VPS MCP `search_workflows` + `list_credentials` (names only), Twenty MCP `get_object_metadata` (metadata only, no record reads), `bunx vitest run` in `crm/`. No live agent (Alex `agent_8201…`, Emily, Nora) and no ElevenLabs/Retell/Twilio/Cal.com API was called. Nothing was written to Twenty, n8n or any vendor.

Status words: EXISTING (artifact verified), PARTIAL, MISSING, UNKNOWN, CONFLICT (two sources disagree; both values given, none picked).

## 1. Repo and runtime topology

| Area | Status | Evidence |
|---|---|---|
| Client portal app | EXISTING | `crm/` Next.js + Drizzle/Postgres, 606 src files, 171 test files (`crm/tests/{unit,integration,e2e}`), runner Vitest (`crm/package.json` `test`, `test:integration` needs Postgres). |
| Portal<->n8n contract | EXISTING (partly target) | `docs/portal-n8n-contract.md`, `crm/src/server/integrations/n8n.ts`, lead hook `crm/src/server/leads/intake.ts`. |
| n8n workflow copies | EXISTING | `n8n/manifest.json` (55 ids), `n8n/workflows/{active,archive,dev}`, `tools/n8n_backup.py` (read-only). Repo ids are the **n8n Cloud** ids. |
| Deploy config | EXISTING | `crm/deploy/{prod,portal-new,preview,dev}`, `scripts/deploy-dev*.sh`; CI `.github/workflows/crm-ci.yml`, `crm-image.yml`, `crm-preview.yml` (crm/ changes only). |
| Provider tooling | EXISTING | `tools/retell.py`, `providers/elevenlabs/*`, `retell/builds/*`. |
| System docs/templates | MISSING | No `docs/systems/`, `templates/`, `fixtures/` before this branch. |
| Shared n8n base workflow, schemas, sink adapters | MISSING | Only portal-side adapters exist: `crm/src/server/adapters/{email,sms,storage,voice}` with fake signature helper. |

## 2. Twenty (https://crm.kyneticai.com, v2.46.0 per KYNETIC_CONTEXT.md)

47 objects returned by `get_object_metadata` (includeFields). Custom/business objects and key fields:

- `endCustomers` (38 fields): leadSource, consentText, consentAt, formSubmittedAt, firstRingAt, leadStatus, attemptCount, nextAttemptAt, lastOutcome, callOptOut/callOptOutDate, smsOptOut/smsOptOutDate, phones, emails, secondsToFirstRing, lastCallId, clientAccount, clientJobs, customerInteractions.
- `customerInteractions`, `callLogs`, `callRecordings`, `clientJobs` (status, scheduledAt, bookingUrl, value), `clientAccounts` (retellAgentId, twilioNumber, calEventTypeId, consentWordingApproved, qaPassedAt, goLiveAt), `invoices`, `expenses`.
- Native with custom fields: `companies` (niche, market, ownerGate, state, engine* fields), `opportunities` (stage, tier, mrr, services, leadSource, dialer, lostReason), `people` (contactRole).
- Campaign model: `messageCampaigns`, `messageLists`, `messageListMembers`, `campaignDeliveries`, `messageSuppressions` (**email address only**), `blocklists`, `shortLinks`.
- MISSING for the spec: Consent Grant, phone/channel Suppression, Conversation, Outreach Attempt, Appointment, Automation Lease, Usage Ledger, Event/Audit Log, Integration Checkpoint, quote revision, maintenance plan, referral token. Per spec, add only after approved delta (D-S04).
- UNKNOWN: roles/permissions, webhooks configured, workflows inside Twenty, record counts, backup restore state (not read).

## 3. n8n on the VPS (read via MCP)

29 workflows. Active: **one** — `WxIh0Hw4lQodY1Xa` "Website | Contact Form to Twenty" (created 2026-11-04, active). All others inactive, including: `tXJwNTkNgKGnp0Ab` Retell Outbound Speed to Lead, `xlmyRd5jBBBu8LX7` 11Labs Outbound Speed to Lead, `fJjshZWiUN0xPcCE` Retell test, `3RdmNRxd17POGzlB` Cal.com Booking SMS (Twilio), DEV set tagged DEV (`hwjiTYVg91i5vIFS` ElevenLabs Speed to Lead, `wWsM69Xx1B8Mfy9s` Setup Safety Check, `p9gPYyRPtd00Wt0h` missed-call, `mMBRyfd3NiWLLLQI` reminder, `cYHVXD1blenqvalE` owner-alert, `ijQVSulzSU5HeQp5` error-alert), plus imported copies of Emily, Nora, Riley, etc.

Credentials (names/types only): Retell API (outbound) abdullahblitz, Retell main and "5454" test, Blitz (OpenRouter), Twenty Webhook account, Kynetic AI (Twilio), Twenty self-hosted, Gmail account. No ElevenLabs or Cal.com credential is in n8n.

UNKNOWN: n8n version/edition, execution mode, persistence, reverse proxy, error-workflow wiring (MCP does not expose them).

## 4. Tests run

`cd crm && bun install --frozen-lockfile && bunx vitest run` -> 61 files, **468 tests passed**, 6.6 s (unit tier only; the integration tier needs PostgreSQL and was not run). This is the existing baseline; no new system tests exist yet.

## 5. Conflicts (not resolved here)

1. **Twenty env var name.** `.env.example:18`, `AGENTS.md:24`, `scripts/checks/checks.py:136` say `TWENTY_API_KEY`; the handoff and standing rules say only `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY` (`TWENTY_API_KEY` dead). Left unchanged.
2. **n8n workflow state/IDs.** `n8n/manifest.json` and `KYNETIC_CONTEXT.md` list Alex `m2YJwZ1l8DTzyEkw` and Nora `2PFWFqBM0wabADk6` as active (Cloud). The VPS shows different IDs, all inactive except the contact form. Canonical n8n = VPS per memory; Cloud state unknown.
3. **Twilio A2P.** `docs/known-issues.md` KI-003 and `docs/decisions.md` D-025 say A2P not registered; Abdullah's 2026-11-04 note says campaign CJUDEQY verified 2026-10-28. Twenty is canonical but was not read for this.
4. **System of record.** Spec: Twenty sole operational record. Repo: portal has its own contacts/deals/consent/lead tables (`crm/src/server/db/schema`). See D-S02.
5. **Portal auth.** KI-013 (open mode) vs commit `d9e2323` restoring sign-in; live portal state not verified.
6. **Consent/DNC decision owner.** automation-map B3 marks portal `outbound/gate.ts` vs n8n as a conflict; contract says single sender must be chosen first.
7. **Handoff spec "Emily/Alex" status** in `KYNETIC_CONTEXT.md` still names Retell as platform (D-018) while D-025 supersedes for Alex.

## 6. Sandbox capability (to verify later, not tested)

ElevenLabs: free tier is demo-only (D-025); sandbox agents recorded in `docs/codex/dev-resources.json` unverified. Twilio: one number, A2P per above; trial limits unverified. Cal.com: free plan; webhooks/ETag behavior unverified. Twenty: single production instance; no sandbox workspace found. Unsupported behavior => mock.

## 7. Artifacts created in Phase 2a (2026-11-06)

| Artifact | Where | Notes |
|---|---|---|
| Policy engine (Code-node source) | `templates/shared/policy-decide.js` | Pure; allow/defer/suppress/human_review; suppression, DNC, opt-out, FL/OK owner (not service address), consent, lease, quiet hours in contact tz, unknown tz -> human review |
| Sink adapter (Code-node source) | `templates/shared/sink-send.js` | No I/O; rejects non-test recipients; stable fake provider ids; SMS segment count |
| JSON Schemas | `templates/shared/schemas/canonical-event.schema.json`, `policy-decision.schema.json` | version `1.0-proposed` |
| Repo copy of workflow | `n8n/workflows/dev/sys-sandbox-dispatch.json` | Manual trigger -> Policy decide -> Sink send; inactive; no credentials; no HTTP node |
| **n8n VPS workflow (live write)** | `MOqT97N0ItVyKIno` "DEV - sys-sandbox-dispatch", tag DEV, **inactive**, personal project of abdullah@kyneticai.com | Created via n8n MCP; one pinned test run (execution 1, success, opted-out synthetic input); no credentials attached |
| Tests | `crm/tests/unit/systems-policy-sink.test.ts` (16 tests) | Run the exact Code-node source from the workflow JSON via `vm` |

No Twenty, ElevenLabs, Retell, Twilio or Cal.com write was made. Nothing was activated.
