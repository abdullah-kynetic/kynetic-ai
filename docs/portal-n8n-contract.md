# Portal / n8n contract — M12-01 (F-76, F-77, F-89)

Draft for review, 2026-10-31. Audited against `3ff1685` on `work`. This document distinguishes existing interfaces from proposed interfaces; it does not enable n8n sending or supersede locked decisions. SECURITY 3.1 and the portal OutboundGate remain in force until M12 parity and owner sign-off. No workflows are activated by this contract.

## Existing transport

### Lead intake: n8n → portal

`POST /api/hooks/leads/{tenantId}` is implemented in `crm/src/server/leads/intake.ts`. The UUID in the path is an identifier, not authentication. Use a per-tenant signing secret, never a browser session or provider credential. Secret issuance exists as a server helper; the admin surface is M12-05.

Sign the exact raw JSON bytes with HMAC-SHA256 over `timestamp.rawBody`. Headers: `X-Kynetic-Timestamp` (Unix seconds), `X-Kynetic-Signature: sha256=<hex>`. Freshness is ±300 seconds. Re-sign retries with a fresh timestamp; keep the same source and externalId. Body limit is currently 16,000 JS string characters (Content-Length is also checked); byte-exact enforcement for multibyte text needs hardening before accepting arbitrary source payloads.

The strict normalized shape in `leads/payload.ts` accepts `externalId` (1–200 characters), `source` (lowercase slug, 1–40), optional firstName, lastName, phone, email, serviceType, message, address, consent. At least phone or email is required. Phone normalization supports US/Canada national or E.164; email is normalized by the validation facade. Address accepts line1, city, region, postalCode; it does not accept `state`. Source adapters must map provider-specific payloads to this shape; raw Meta/Angi/LSA payload acceptance is not established.

Consent is optional and contains capturedText, optional wordingVersion, capturedAt, ip, and channels (`phone_call`, `sms`, `email`). Omit consent when evidence is absent; never infer it from a source name. Existing validation permits omitted capturedAt and defaults channels to phone_call: the adapter must supply actual capture evidence, and counsel review remains open. The region/state mapping to the compliance gate needs a tested resolution before live contact.

A 200 response `{ok:true,data:{status:"accepted"}}` means durably queued, **not** contact/deal creation completed. Duplicate returns the same envelope with status `duplicate`. The dedupe key is source `lead_webhook` plus `${tenantId}:${source}:${externalId}`. Storage and queue insertion are one transaction. Processing creates/reuses the contact, creates a deal, stores evidence and emits `lead.created` in a tenant transaction. Do not start a call from the intake acknowledgement; wait for the committed event. The existing portal call subscriber still reacts to that event: future n8n call dispatch must remain inactive until a single sender is selected and tested.

401 = invalid/expired signature, 400 = invalid payload, 403 MODULE_DISABLED = alex_core off, 429 = rate cap. Correct permanent errors rather than retrying indefinitely. A response lost after commit is retried with the same id.

### Portal → n8n events

`server/integrations/n8n.ts` currently sends only `lead.created`, `deal.stage_changed`, `call.completed` to the platform module's configured webhook URL. Envelope:

```json
{"id":"<uuid>","name":"lead.created","version":1,"tenantId":"<uuid>","occurredAt":"<UTC ISO time>","actor":{"type":"system"},"payload":{"contactId":"<uuid>","dealId":"<uuid>"}}
```

Payload varies by producer; consume only documented fields for the event, and reject unsupported versions. IDs, rather than client PII, belong in events. Read details through a tenant-scoped service route.

Headers are `x-kynetic-event-id`, `x-kynetic-event-name`, `x-kynetic-signature`. The signature is plain hex HMAC-SHA256 of the raw body, **without** the lead transport's timestamp or `sha256=` prefix. These are different protocols; do not interchange verifiers. Current outbound signatures have no freshness window: n8n must persist dedupe by `(tenantId,id,consumer)` and validate tenant/name headers against the signed envelope. Timestamped outbound signing is future hardening, not implemented here.

Delivery is at least once; non-2xx throws. pg-boss queues use retryLimit 6, initial delay 30 seconds, exponential backoff capped at 3600 seconds (`jobs/queues.ts`). A timeout can follow a successful remote effect: dedupe before executing side effects. Exhausted jobs require operator review; do not silently regenerate IDs. n8n should acknowledge only after durable receipt. This retry policy is existing portal behavior; it is not a guarantee about unbuilt n8n workflows.

### Service reads and provider hooks

`GET /api/service/contacts/{id}` requires `Authorization: Bearer <tenant service token>` and scope `contacts:read`. Tenant identity comes from the token row, never a body/path tenant override; use `withServiceTenant` and RLS. Invalid/revoked/wrong-scope tokens return 401. A foreign contact is 404. Tokens are hashed; raw issuance values are shown once. Do not put tokens in URLs, workflow exports, logs or fixtures.

`POST /api/hooks/voice/{provider}` verifies the **provider** signature and queues the original provider event. It is not an n8n-normalized-result endpoint: reserializing a provider body breaks its signature. A normalized authenticated relay route must be built by M13-03. Existing Twilio inbound/status and Resend hooks likewise expect native signatures; never let n8n impersonate a provider with an unsigned normalized body.

`GET /api/appointments/availability` and `POST /api/appointments/book` exist with service authentication. These are portal availability/booking functions, not proof of Cal.com synchronization. Cal.com remains the proposed calendar authority; M13-05 must define external event mapping and dedupe before using both calendars.

## Target interfaces (reserved design, none implemented by this document)

All new service routes use tenant-scoped bearer authentication with a distinct least-privilege scope, server-side module checks, strict versioned schemas and RLS. No route accepts an arbitrary tenantId to override the token. Mutation envelope: `eventId` UUID, `version:1`, `occurredAt` UTC ISO time, and a task-specific payload. Store an idempotency key `(tenantId, operation, eventId)` and the effect atomically; repeated identical requests return the original result without another effect, changed payload under the same key returns 409. Foreign record IDs return 404. This is a requirement for later tasks, not the current service API's behavior.

| Interface to build | Scope | Payload / effect | Owner task |
| --- | --- | --- | --- |
| POST /api/service/contact-decisions | contact-decisions:write | contactId, channel, allow/deny, reasonCode, ruleVersion, firedRule, evaluatedAt; append timeline evidence, never authorize a portal send | M12-03 |
| GET /api/service/contact-policy/{contactId} | contact-policy:read | consent evidence, DNC, timezone/state, counts and tenant state; minimize returned PII | M12-06 |
| GET /api/service/send-state | send-state:read | global kill switch, tenant pause/suspension and checkedAt; no secrets | M12-04 |
| POST /api/service/call-results | calls:write | contactId, provider, providerCallId, outcome, start/end, transcript and allowlisted recording reference; dedupe by tenant/provider/call id too | M13-03 |
| POST /api/service/appointments/sync | appointments:write | Cal event ID, contact/deal IDs, times, status; dedupe external ID, emit appointment lifecycle event atomically | M13-05 |
| POST /api/service/opt-outs | consent:write | contactId, channel, source event ID and evidence; record revocation before acknowledging | M13-08 |
| POST /api/service/messages | messages:write | provider message ID, contactId, channel, delivery status and content reference; log only, no send | M14-01 / M14-05 |
| POST /api/service/payments | payments:write | external payment ID, dealId, paidAt, integer amountCents; emit payment.received once | M14-04 |
| POST /api/service/metrics/daily | metrics:write | explicit UTC day and tenant-local reporting boundary; compute portal math idempotently | M15-01 |
| GET /api/service/reports/weekly | reports:read | period, aggregates and report link; n8n owns delivery | M15-02 |
| POST /api/service/automation-results | automation-results:write | workflow/run ID, action, status, reason, related record IDs; append safe timeline/log entry | M13-07, M14, M15-04 |
| GET /api/service/agency-backup | agency-backup:read | allowlisted agency data and anonymous client aggregates; no client personal data | M18-01 |

Exact schemas, error codes and migrations travel with those tasks and their security tests. No blanket `*:write` token. A contact-decision log is evidence, not a reusable send permit. Each send must read current policy and kill state immediately before dispatch; lookup/log failure fails closed. The allow/deny workflow, parity suite and sender cutover remain mandatory. No workflow retries a provider send unless it has a provider idempotency key or has reconciled the prior result; an unknown outcome needs review, not another blind send.

## Automation ownership and endpoint coverage

“Target” below means a reserved interface above or a later task's UI/service; it must not be treated as a callable route yet. This covers every automation-map row, including agency work beyond M12.

| Map | Execution / record owner | Existing endpoint or target handoff |
| --- | --- | --- |
| B1–B2 intake/dedupe | n8n normalizes; portal persists | Existing lead hook → committed lead.created → contacts read |
| B3 contact rules | n8n after parity; portal evidence | Target contact-policy, send-state, contact-decisions |
| B4 start Alex | n8n after M12 gate | lead.created + contacts read → ElevenLabs; target automation-results; portal sender cutover required |
| B5 results | n8n relays; portal persists | Target call-results; existing native voice hook stays signature verified |
| B6 booking | n8n + Cal.com; portal mirror | Target appointments/sync → appointment.booked |
| B7 retries | n8n schedule | Contact-policy + send-state + contact-decisions before each attempt; call-results stops retries |
| B8 SMS follow-up | n8n; portal log | Target messages and contact-decision routes; A2P blocked |
| B9 booked stage | portal | appointment.booked subscriber → Estimate Booked (M13-06) |
| B10–B11 reminders/no-show | n8n; portal records | Target appointments/sync and automation-results; appointment lifecycle subscription not yet exported |
| B12 new/hot alert | n8n; portal records | lead.created / call.completed → target automation-results; dedupe each recipient/action |
| B13 upsells | n8n after cutover; portal retains data | Target messages and automation-results; existing portal workers remain until M14-08 |
| B14 review request | n8n; portal payment record | Target payments → payment.received → delayed decision check → messages |
| B15 daily metrics | n8n triggers; portal computes | Target metrics/daily |
| B16 weekly email | n8n sends; portal data | Target reports/weekly and automation-results |
| B17 monthly report | portal page/math; n8n email | Existing dashboard reports pages; service report handoff to be added in M15-03 |
| B18 STOP | n8n acts; portal consent | Existing native Twilio inbound; target opt-outs for relay; preserve channel semantics |
| B19 workflow failures | n8n error workflow | Target automation-results; email adapter fake first (M15-04) |
| A1 agency intake | n8n; agency tenant records | Existing lead hook only after M16 agency tenant setup; Cal sync target |
| A2–A4 lists/dialer/campaigns | portal; sourcing in n8n/tools | M16-02/03/04 UI/services and M20-01 import handoff to define; no automated cold calls |
| A5 pipeline | portal | Existing tenant deal/stage services; agency stages seeded in M16-05 |
| A6 proposals | portal drafts | M17-01 UI/service to define; never auto-send |
| A7–A8 invoices/payment/dunning | n8n; portal records | M17-04/05 test-mode Stripe handoff; target payments; real writes require yes |
| A9 onboarding | portal | Existing admin onboarding; secret admin screen M12-05; won-deal flow M17-03 |
| A10 digest | n8n | M18-02 data handoff to define; target automation-results for delivery record |
| A11 reporting | portal | Existing aggregate math; agency revenue/expense view M20-04 |
| A12 Twenty backup | n8n, one way | Target agency-backup; allowlist test and supersede confirmation M12-02 required |

## Acceptance and open review

M12-01 deliverable is drafted; owner review is pending. Existing shape/signature/idempotency behavior above was inspected in source, not exercised against n8n. Each target requires enabled/disabled module tests, cross-tenant tests, invalid/revoked/wrong-scope auth tests, replay/concurrency tests and no-real-provider fixtures. No source adapter fixture proves Meta/Angi/LSA end to end yet.

Current `backup.run` is confirmed in source: worker schedules nightly encrypted database backup at 02:00 UTC and monthly scratch restore at 03:00 UTC on day 1; implementation is `server/admin/backups.ts`. This is distinct from the proposed Twenty data export and must not be repurposed or removed. Live backups/restore results were not checked in this audit.

Locked supersedes (DC-TBD-03/04/07/08), counsel rules, A2P, invoicing provider choices and explicit gate approval remain separate from permission to build local code. Retell code already exists despite the proposed “not built” wording: leave it and protected agents untouched; retirement is not implied.
