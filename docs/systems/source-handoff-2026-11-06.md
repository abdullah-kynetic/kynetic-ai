# Kynetic AI — Systems & Automations Build Handoff

**Document type:** implementation-discovery and build specification for Claude  
**Prepared:** 2026-11-06  
**Status:** proposal, not a record of implemented behavior and not approval to modify production  
**Audience:** Abdullah Ahmed and the engineer/agent implementing the systems

---

## Paste-ready instruction to Claude

Read this entire specification before writing code. First inventory the actual repository, Twenty configuration, n8n workflows, templates, deployment configuration and test artifacts **read-only**. Produce a short evidence-backed inventory that distinguishes existing, partial, missing and unknown; cite exact artifact paths or configuration identifiers. Do not inspect or mutate any live agent merely to satisfy the inventory.

Refine this master document and create one detailed Markdown document per system, including an explicit traceability matrix from requirements to workflows, data fields and tests. Resolve small implementation details using the proposed defaults below, and record departures as decisions rather than silently assuming them. Verify actual vendor APIs, Twenty object metadata, webhook behavior, n8n node behavior and consent/recording requirements against current documentation; examples here describe desired contracts, not verified endpoints.

Build standalone automations before portal integration. Keep automation logic independent of the standard client portal, expose versioned integration contracts, and treat any bespoke portal as a separately scoped deliverable. Build only in a new isolated branch and isolated, net-new sandbox agents/workflows after the specific approvals required by the standing rules. Never assume a planning or documentation request authorizes production writes. Add mocked and approved-sandbox tests, including failure, retry and cross-system conflict tests. Send no real outreach, place no real calls, alter no ads and make no production modifications.

Standing prohibitions apply throughout: never use Twenty REST `DELETE`; never touch Nora, the live Emily agent, live Alex `agent_8201…`, or Kynetic Restoration Demo; do not activate any workflow or publish Alex without an explicit yes; no secrets in commits; commits, if separately approved, use `abdullah-kynetic` with no AI trailer. Preview-only site deployments; DNS changes require approval. Actual writes to Twenty, n8n, ElevenLabs, Retell, Notion or GitHub main require an explicit scoped yes. Use only environment variable names `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY`; `TWENTY_API_KEY` is dead. Do not use Google Drive, Docs or Sheets for Kynetic. Return evidence of tests and a list of all artifacts changed. Treat every design statement in this document as a proposal until verified.

---

## 1. Purpose and agreed product boundary

Kynetic is positioned as an **AI growth partner**, not a bundle of tools. Each deliverable must connect to an operational outcome, measurable adoption and accountable follow-up; results must not be represented as guaranteed.

This handoff covers these agreed, individually visible systems, grouped into broad service families without collapsing them:

| Service family | Individual systems in this document |
|---|---|
| Revenue Response | 1. Speed-to-lead Alex; 2. Inbound receptionist Emily; 3. Missed-call text-back |
| Pipeline Conversion | 4. Quote follow-up; 5. Old-lead/database reactivation; 6. Long-term nurture |
| Customer Growth | 7. Reputation/review automation; 8. Referral automation; 9. Maintenance/reminder automation |
| Revenue Infrastructure | 10. One configurable CRM deliverable; 11. Scheduling |
| Acquisition & Visibility | 12. Online presence; 13. Ads management/tooling, with client media spend separate |
| Platform & Engagement Services | Standard portal integration; separately scoped bespoke portal; internal Kynetic maintenance; custom AI/back-office systems; full transformation and on-site rollout |

CRM Lite and CRM Full are **merged into one deliverable**. Scope and price are configurable by implementation complexity, with commercial terms still pending; do not silently select either former tier.

### 1.1 Scope status vocabulary

- **Agreed:** explicitly given in this handoff as a product/standing requirement.
- **Proposed default:** recommended starting behavior; validate during discovery.
- **Verify:** API, tenant or vendor capability that has not been established here.
- **Unknown:** prior artifact or implementation state not available in this handoff.
- **Excluded:** requires separate scope rather than being implied by “AI transformation.”

No repository inspection was performed for this document. Existing code, deployed workflows, portal status and production configuration are **unverified**. Earlier references to Emily, maintenance or other systems do not prove that an implementation exists.

### 1.2 Original-scope interpretation

- **Alex:** speed-to-lead response and qualification for incoming leads, with voice and potentially consented messaging channels.
- **Emily:** inbound receptionist. This is the working meaning supplied for this build; exact legacy prompts, behavior and current artifacts are unknown. Do not inspect or alter the live Emily agent.
- **Maintenance automation:** treated here as **customer-facing maintenance reminders and service rebooking** (for example, recurring HVAC maintenance or a remodel warranty check-in). The prior transcript is unavailable, so original intent remains unresolved. Internal Kynetic platform maintenance is specified separately and must not be conflated with this client-facing system. Client discovery decides whether a remodeling niche needs warranty check-ins instead of recurring service.
- **Online presence:** business-profile/listing and local-presence operational support, not a magical guarantee of rankings. Exact legacy vendor/tool choices are unverified.
- **Scheduling:** calendar-aware booking and lifecycle handling in coordination with lead-handling systems, not simply a link inserted in messages.
- **Referral:** permissioned post-success referral requests and referral attribution, not purchased lists or unsolicited referral spam.
- **Ads:** campaign operations and supporting tooling, with ad spend paid separately from the client’s own accounts. Ads execution access, assets and account state are unverified.

---

## 2. Delivery and safety contract

### 2.1 Read-only discovery first

The first implementation phase is read-only:

1. Find repositories and deployment manifests without scanning unrelated systems.
2. Enumerate Twenty objects/fields using supported metadata reads only. Do not assume field identifiers.
3. Export/read only relevant n8n workflows through an approved method. Record names, IDs, triggers, credential references without values, error workflows and activation state.
4. Identify the standard portal’s API/event boundary from source and documentation. Do not change it.
5. Record existing notification, consent, appointment and lead identifiers. Locate existing deduplication before introducing another schema.
6. Identify sandbox capabilities. Actual ElevenLabs, Twilio, calendar or CRM sandboxes may differ; mock unsupported behavior.
7. Produce `build-inventory.md` with evidence, unknowns and conflicts. No state-changing “test” call counts as read-only inventory.

### 2.2 Environment separation

Implement four conceptual environments:

- **Local/mocked:** no external sends; fake tenant and contact data; recordings/logs contain no real customer information.
- **Sandbox:** net-new resources, allowlisted test destinations, separate credentials and tenant IDs, capped usage.
- **Staging:** full integration behavior with synthetic or explicitly authorized data, still no public outreach.
- **Production:** separate credentials, encrypted secret storage, explicit activation approval, monitored rollout and rollback by disabling new automation only.

PROHIBITED resources must not be used as test targets. Name new sandbox assets unambiguously (for example `dev_alex_<tenant>_<random>`), tag ownership and environment, and prevent environment confusion with credential allowlists.

### 2.3 External effects

All voice calls, SMS, email, review requests, referral requests, ad changes, calendar writes and CRM writes are mocked or confined to an explicitly approved sandbox during build. “Dry run” must be enforced at the transport layer, not just promised in a prompt. Use sink adapters that capture payloads and return stable fake provider IDs.

No production activation, deployment, main-branch commit or commercial package change follows automatically from this document. Rollback plans cannot depend on deleting Twenty records because REST `DELETE` is forbidden; use active/inactive status, archival supported by verified non-delete APIs, or isolation of new records.

### 2.4 Privacy, consent and legal boundaries (not legal advice)

- Record the provenance, purpose, timestamp, wording/version and channel of consent. Consent for one channel or campaign is not universal consent.
- Suppress numbers on applicable do-not-call lists and internal suppression lists. **AM-1 Roofing is do-not-call.** Implement tenant-independent global suppression as well as per-tenant suppression.
- Do not pursue Florida- or Oklahoma-based business owners. This rule targets **owner/business eligibility**, not a blanket prohibition on a homeowner’s service address; preserve both fields and evaluate the correct one.
- No HIPAA-regulated niches. Start with remodelers; pool builders, solar, HVAC and roofing are later examples subject to eligibility review.
- Honor opt-outs immediately across channels. `STOP` must create an atomic SMS suppression before any queued message can release; equivalents such as “stop texting me” should be recognized with a safe fallback and human review for ambiguity.
- Apply quiet hours in the **contact’s verified timezone**, not server time; unknown timezone defaults to no automated send until safe review. Account for daylight-saving changes and statutory exceptions through policy configuration verified with counsel.
- AI disclosure and call recording consent requirements vary by jurisdiction. Verify current legal requirements with counsel before enabling recording or AI voice. Do not infer permission to cold-text from A2P registration; registration is not consent.
- Collect only necessary data. Do not copy sensitive Salesforce fields into Twenty merely because they are accessible.

---

## 3. Target architecture (proposal, APIs to verify)

### 3.1 Logical components

```text
Sources (forms, calls, ads, imports, client CRM, calendars)
             |
      ingress adapters + verification
             |
   canonical event envelope + dedupe
             |
 policy/tenant loader -> coordination & eligibility decision
             |
      n8n workflow orchestration
       |           |             |
 voice adapter  messaging      scheduling/CRM/adapters
 (ElevenLabs)   adapters        (capabilities verified later)
       \           |             /
          Twenty operational event/fact record
                       |
             metering + observability
                       |
      standard portal integration boundary (non-blocking)
```

Twenty self-hosted is Kynetic’s **sole operational system of record**. n8n on the VPS orchestrates. ElevenLabs through n8n is the intended Alex voice platform; Retell is parked and must not be provisioned or altered. The standard portal consumes/presents operational information but must not contain the only copy of lead state, consent, suppression or automation policy.

Proposed adapter interfaces:

- `LeadSourceAdapter.normalize(raw) -> CanonicalLeadEvent`
- `ChannelAdapter.send(command, idempotencyKey) -> DeliveryReceipt`
- `VoiceAdapter.start/sessionResult(...)`
- `CalendarAdapter.availability/hold/confirm/cancel(...)`
- `CrmAdapter.upsert/find/read/map(...)`
- `PolicyEngine.authorize(context) -> Allow | Defer | Suppress | HumanReview`
- `PortalProjection.publish(sanitizedEvent)` as a non-critical consumer

Names are logical contracts, not prescribed TypeScript packages or n8n node names. Vendor payloads stay at the edge; durable workflows use canonical IDs and enumerated statuses.

### 3.2 Standalone automation before portal integration

Every automation must work from signed webhooks, scheduled jobs or explicitly initiated sandbox commands without a browser session in the portal. The portal can display status and request a permitted action through a backend, but:

- no n8n workflow may require DOM automation or portal cookies;
- no critical consent or suppression update waits for a portal webhook;
- portal downtime creates retryable projection failures, not lead-processing failures;
- portal views query approved server-side projections with tenant authorization;
- no shared mutable browser-local state coordinates campaigns.

A custom client portal with bespoke dashboards, roles or workflows is **not assumed included or priced**. It receives a separate discovery, UX, security, integration, acceptance and maintenance scope.

### 3.3 Tenant configuration

Proposed `tenant_config` fields, to map only after metadata inspection:

| Field | Required | Default/proposal |
|---|---:|---|
| `tenant_id`, `environment`, `active` | yes | immutable opaque ID; new tenants inactive |
| legal/display name, business timezone, service area | yes | no assumed timezone |
| owner country/state and niche eligibility | yes | ineligible until reviewed |
| enabled systems and per-channel enable flags | yes | all false |
| business hours, handoff hours, holiday calendar | yes | human review if absent |
| pipelines, stages, job values and loss reasons | yes | explicit map, no guessed labels |
| consent policy version, quiet hours, opt-out aliases | yes | restrictive defaults |
| AI disclosure/recording policy | voice | recording off until verified |
| calendar IDs/resources/timezone/appointment types | scheduling | none until verified |
| contact preferences and suppression scope | yes | deny conflicting outreach |
| retry/backoff/rate limits/caps | yes | conservative sandbox values |
| voice IDs, agent IDs, phone-number IDs | voice | sandbox only; secret references, never values |
| CRM authority map and external IDs | integrated clients | field-by-field matrix |
| branding, FAQs, escalation contacts | yes | approved test values |
| usage budgets and hard/soft cap behavior | yes | separate sandbox and production caps |

Onboarding cannot be “complete” until required field values, consent sources, DNC handling, test destinations and escalation ownership are validated. Store secret references in approved secret management; Twenty records should not contain raw tokens.

### 3.4 Proposed operational data contracts

Prefer native Twenty objects where appropriate; add custom objects only after read-only metadata verification. Proposed logical entities:

- **Person / Company:** identity, normalized phone/email, owner eligibility, service address, timezone, preferred channel, lifecycle, external source IDs.
- **Opportunity / Job:** pipeline, stage, amount/currency, service type, source, owner, quote date/expiry, won/lost timestamps, loss reason.
- **Consent Grant:** subject, channel, purpose, source, disclosure version, captured timestamp, evidence reference, expiry if applicable, revoked timestamp.
- **Suppression:** subject/channel/scope, reason, origin, effective timestamp, global/tenant scope. No hard deletion.
- **Conversation:** system, channel, external provider ID, lead/person, state, AI/human ownership, disclosure status, summary, last activity.
- **Outreach Attempt:** policy decision, template/version, scheduled/sent/delivered/failed timestamps, idempotency key, provider result, opt-out result.
- **Appointment:** external event/hold ID, resource, start/end/timezone, state, buffer, owner, audit history.
- **Automation Lease:** lead + conversation/channel + system, expiry, workflow version; prevents parallel campaign ownership.
- **Task / Human Handoff:** reason, severity, assignee, SLA, resolution.
- **Usage Ledger:** tenant, provider, resource type, quantity, provider usage ID, occurred timestamp, estimated/actual flag, cost version. Meter voice minutes, SMS **segments**, email where billable, model/tool calls and third-party charges.
- **Event / Audit Log:** canonical event, actor, source, correlation/causation IDs, received/processed time, redacted metadata, error classification.
- **Integration Checkpoint:** source cursor, external version/etag, last successful sync, failure count.

Do not confuse projected “stage” with event history. Stage can be overwritten by an authorized source; history is append-only. Personal data in logs must be minimized and redacted.

### 3.5 Fake canonical event example

```json
{
  "schema_version": "1.0-proposed",
  "event_id": "evt_fake_01JEXAMPLE",
  "event_type": "lead.created",
  "tenant_id": "tenant_fake_remodeler",
  "environment": "sandbox",
  "occurred_at": "2026-11-06T20:00:00Z",
  "source": {"kind": "web_form", "external_id": "form_sub_fake_1042"},
  "subject": {
    "person_ref": "person_fake_001",
    "phone_e164": "+15550100142",
    "email": "alex.example@invalid.example",
    "timezone": "America/Los_Angeles"
  },
  "service": {"category": "kitchen_remodel", "postal_code": "90000"},
  "consent_refs": ["consent_fake_voice_01", "consent_fake_sms_01"],
  "trace": {"correlation_id": "corr_fake_01", "causation_id": null}
}
```

`invalid.example` and the deliberately fictional `555-01xx` number pattern are for tests. Never substitute actual client contacts in fixtures.

### 3.6 Scheduling command example

```json
{
  "command_id": "cmd_fake_book_01",
  "idempotency_key": "tenant_fake_remodeler:appointment_fake_01:confirm:v1",
  "tenant_id": "tenant_fake_remodeler",
  "person_ref": "person_fake_001",
  "appointment_type": "estimate_60m",
  "calendar_hint": "calendar_fake_estimates",
  "window": {
    "start": "2026-11-10T17:00:00Z",
    "end": "2026-11-10T18:00:00Z",
    "timezone": "America/Los_Angeles"
  },
  "policy": {"allow_external_write": false},
  "expected_external_version": "fake_etag_7"
}
```

The scheduling adapter must reject production writes when `allow_external_write` is false, even if a workflow bug invokes it.

---

## 4. Coordination and precedence across systems

### 4.1 Canonical lifecycle and conflict rules

Maintain a normalized lifecycle independently of source-specific labels:

```text
new -> attempting_contact -> engaged -> qualified -> appointment_proposed
    -> appointment_booked -> estimate/quote -> won | lost | nurture
Any active nonterminal state -> opted_out | suppressed | disqualified | human_owned
nurture -> engaged (new intent), or exhausted/suppressed
won -> review_eligible -> referral_eligible -> maintenance_eligible (where applicable)
```

Actual stages are tenant mappings; do not flatten confirmed client stages just to match this example.

Priority from highest to lowest:

1. **Safety/suppression:** DNC, opt-out, ineligible owner/niche, legal restriction, unsafe data.
2. **Human ownership:** explicitHumanHandoff` prevents automated continuation until released by an authorized event.
3. **Active live conversation:** currently connected call or human-chat session.
4. **Appointment safety:** confirmation/reschedule/cancellation; no competing promotional outreach during the transaction.
5. **High-intent response:** Alex, inbound Emily and missed-call recovery.
6. **Open revenue process:** quote follow-up when an active quote exists.
7. **Reactivation/nurture:** only if no active higher-priority journey.
8. **Post-success requests:** review, then referral, then maintenance according to cooldown and service dates.
9. **General marketing:** only if all higher-priority checks permit it.

A single `JourneyCoordinator` decision service, even if initially implemented as one shared n8n subworkflow plus persistent locks/subscriptions, is preferable to each workflow independently querying stage.

### 4.2 Atomic lease proposal

Before contacting a person, request a lease keyed by `(tenant_id, person_id, channel)` and store `(system, conversation_id, expires_at, policy_version)`. Retrying with the same idempotency key returns the same result. A stale lease may be recovered only after expiry and a check that the provider has no active session. Voice and SMS may be allowed together only as explicit parts of one conversation, such as sending appointment details during a call; independent campaigns may not overlap.

Proposed defaults, to tune after usability testing:

- Post-call no-independent-message window: 10 minutes, except transactional call follow-through.
- Post-response pause for queued promotional steps: immediately cancel, not merely delay.
- Review-to-referral minimum spacing: configurable; default 14 days.
- Failed provider call: no blind repeated voice attempts; honor attempt/cadence caps.
- All sends recheck suppression and lease immediately before transport execution.

### 4.3 Appointment consistency

Use calendar free/busy at confirmation time, not cached availability alone. Prefer provider-supported conditional create/ETag or short-lived hold if available; otherwise implement a tenant/resource lock and reconcile immediately after create. Double-booking prevention must include two n8n workers handling the same person and two people choosing the same resource.

One appointment owns one external ID and a monotonic revision. Voice, email and SMS all reference it. Cancellation and rescheduling are events, not silently new appointments. Late provider responses are reconciled by idempotency key and external ID.

### 4.4 Duplicate identity and cross-tenant safety

Normalize E.164 phone and lowercase/trim email, but do not merge solely on a name. Household/shared phones need an explicit confidence model. A source external ID + tenant is unique; source replay returns the original result. Potential duplicates enter review if high-confidence automatic merge is unsafe. Never merge records across tenants.

Every workflow execution and record contains `tenant_id`; credentials are resolved by tenant/environment server-side. Add automated tests proving Tenant A cannot read, update, message or meter Tenant B even when external IDs collide. Webhook authentication, replay timestamps and raw-body verification are provider-specific verification tasks.

### 4.5 Won/lost and late events

On `won` or terminal `lost`, cancel quote/reactivation/nurture queues before any subsequent send. A won lead can later enter post-success journeys only after service-completion criteria. A lost opportunity may re-enter only under tenant policy (for example, new explicit inquiry), never because an older queued workflow wakes up.

Late delivery receipts update attribution/telemetry, not lifecycle blindly. Late inbound replies cancel appropriate automation and open engagement. Provider events arriving out of order use occurred time plus external revision; unknown ordering is reconciled from source.

---

## 5. Shared reliability, operations and measurement requirements

### 5.1 Failure taxonomy and retries

| Class | Examples | Behavior |
|---|---|---|
| Invalid permanent input | missing phone, bad mapping, ineligible tenant | no provider call; structured error; onboarding/handoff task |
| Permanent provider denial | unverified caller ID, revoked permission | disable affected integration; alert; no repeated retries |
| Transient | timeout, 429, 5xx, temporary network | bounded exponential backoff + jitter; respect Retry-After |
| Unknown outcome | timeout after send/create request | query by idempotency/external key before retry; never assume unsent |
| Conflicting state | opted out, lost, newer appointment revision | cancel; superseded result |
| Safety/policy failure | signature fail, cross-tenant key | deny and alert; do not retry automatically |
| Downstream portal failure | projection timeout | lead path continues; durable retry |

Use dead-letter **records/queues without Twenty deletion**, redacted payloads and controlled replay. Replay must retain original causation ID, generate a new execution ID and pass current policy again. An error workflow must emit actionable context: tenant, system, correlation, attempt, sanitized provider code and owner.

### 5.2 Observability

Metrics should include workflow runs, latency, queue age, dedupe hits, retries, unknown outcomes, policy denials by reason, active leases, reconciliation mismatches, external-write failures, cap blocks and per-tenant usage. Logs must distinguish “sent,” “accepted by provider,” “delivered,” “responded” and “booked.”

Dashboards do not prove outcomes. Attribution uses source and first/last touch cautiously; outbound-generated appointments may also have other influences. Report denominators, observation windows, timezones, exclusion rules and sample sizes. Never claim revenue causality from correlation alone.

Recommended alerts: no events during expected intake, spike in lead failures, opt-out processing failure, repeated provider auth failure, unexpected usage cap, sync drift, duplicate external appointment, cross-tenant assertion failure (critical). Notifications go to approved internal channels only when separately configured.

### 5.3 Metering and commercial boundaries

Usage metering is required, billing implementation is not authorized here. Capture voice duration using provider billable definitions (including ring/answered treatment once verified), SMS segments and encoding, model/tool units and any vendor fees by tenant. Tag estimated costs with price version; do not present stale vendor prices as current facts.

Previously discussed 1,500 minutes / 2,000 texts fair-use allowances are **provisional only** and not established as viable. Require workload/margin modeling, abuse prevention, configurable soft warnings and hard caps. On a hard cap, stop nonessential automation and create a human task; critical opt-out/suppression always continues. Pricing in prior discussion is proposed, not approved commercial scope.

### 5.4 Shared acceptance and deployment gate

A system is not ready because its happy path ran once. Before activation:

- Inventory and field/API mapping signed off; unknowns resolved or bounded.
- Consent/DNC/quiet hours/opt-out and eligibility tests pass.
- Idempotent replay, unknown send outcome, retry ceilings, provider downtime and stale queue tests pass.
- Cross-system lease and stage conflicts pass.
- Tenant isolation and redaction checks pass.
- Human handoff resumes with correct context and terminates AI ownership.
- All external effects are mocked or approved-sandbox only; no real customer outreach occurred.
- Cost/usage ledgers reconcile to sandbox provider evidence within documented tolerances.
- Standard portal projection failure does not break core automation.
- Monitoring, runbook, owner and disable/rollback mechanism verified.
- A separate explicit approval names what may be activated, in which environment, for which tenant, and when.

The onboarding goal is **about 2 hours of configuration plus 1–2 days of optimization**, not a proven guarantee. Track actual effort by step. Cloning must copy templates, not production credentials, suppression overrides or tenant data. Require explicit tenant-specific validation before activation.

---
## 6. Exact initial reusable-template construction

### 6.1 Known resources versus verified readiness

| Resource | What is known for this handoff | What remains unverified |
|---|---|---|
| Self-hosted Twenty | Approved/default Kynetic operational system of record | version, objects, fields, roles, backups, API behavior, working connectivity, production readiness |
| n8n on a VPS | Intended orchestration runtime | version/edition, execution mode, persistence, queues, reverse proxy, error workflows, credentials, deployment health |
| ElevenLabs | Intended voice platform for Alex through n8n | account plan, new-sandbox agents, telephony wiring, tools, quotas and disclosure settings |
| Twilio | Possible telephony/SMS provider | owned numbers, A2P status, webhook configuration, subaccount design, verified integrations |
| Standard Kynetic portal | Shared client-facing platform to integrate later | current routes, auth, RBAC, public-exposure fixes, APIs, deployment state and whether projections exist |
| Client calendars/CRMs/ad accounts | Possible integration sources | account ownership, APIs, permissions, object mapping and sandbox availability |

“Hosted” or “known in the architecture” is not a claim that the resource is operational. Claude must inventory without altering it and build mock-first if access has not been approved.

### 6.2 Recommended default stack

Build one reusable, versioned **system template**, then thin per-system packs. A practical initial software stack is:

- **Workflows:** n8n workflow JSON exported without credentials; shared subworkflows for policy, identity, Twenty access, metering, error handling and provider adapters.
- **Operational store:** existing Twenty for business facts, plus existing n8n persistence for execution state. Do not create a competing CRM database. For high-throughput locks, use a small PostgreSQL coordination service/table only if native n8n/Twenty transactions cannot guarantee atomic leases; this is operational infrastructure, not another business record.
- **Contract tests:** Node.js + TypeScript with Vitest, JSON Schema validation, and provider-mocking with MSW or locally controlled fake HTTP servers. This is a proposal; align language/test runner to the actual repo after inventory.
- **Template packaging:** one directory per system containing `README.md`, `desired-state.md`, `events.schema.json`, `tenant-config.schema.json`, redacted workflow exports, `field-map.example.yaml`, fake webhooks, test fixtures and `acceptance.md`. Actual n8n credentials and dynamic IDs remain external references.
- **Portal:** extend the existing shared application only after read-only stack discovery. Use its established backend/auth pattern; do not create a new framework or one portal per automation.
- **Observability:** structured logs/metrics from n8n and backend. Add OpenTelemetry-compatible instrumentation if supported by the actual stack; do not require a new analytics vendor for MVP.
- **Secrets:** current approved deployment secret mechanism. Community n8n does not include every enterprise secrets/environment feature, so no assumption of native environment promotion; use deployment-level controls verified in inventory.

Concrete bootstrap work items:

1. `TEMPLATE-00`: document actual repo/runtime topology and map each new artifact location.
2. `TEMPLATE-01`: define JSON Schemas for canonical events, receipts, tenant config, policy decisions and usage entries.
3. `TEMPLATE-02`: implement fake Twenty, channel, voice, calendar and portal adapters; reject non-test recipients and production URLs in tests.
4. `TEMPLATE-03`: build shared n8n ingress → verify → normalize → dedupe → policy → dispatch → audit path, initially inactive.
5. `TEMPLATE-04`: create an inactive example system template using synthetic data; prove replay and tenant isolation.
6. `TEMPLATE-05`: generate tenant config by validation/migration tooling, not by copying raw workflow JSON containing environment IDs.
7. `TEMPLATE-06`: implement standard portal read projection and a backend-command endpoint only for approved controlled actions.
8. `TEMPLATE-07`: test clone into two fake tenants, then measure configuration and optimization duration.

No resources are created by this document.

### 6.3 Replacement adapter matrix

| Layer | Default | Replaceable options | Stable boundary and practical limitation |
|---|---|---|---|
| Operational CRM | Self-hosted Twenty | Client-owned Salesforce or HubSpot compatibility adapters | `find/upsert/sync` with explicit field authority. Twenty remains Kynetic ops record; do not force migration. APIs, editions, API limits and licenses must be verified per tenant. Do not install/connect them for template build. |
| Client-only source CRM | Existing client CRM | Salesforce, HubSpot or other supported client system | Keep source-of-truth matrix and minimum-data operational projection. A spreadsheet is not approved as Kynetic’s system of record and is omitted from the supported stack. |
| Orchestration | n8n on VPS | n8n Cloud; custom worker/queue for special scale needs | Workflows consume canonical events and adapters. Replacing orchestration must preserve idempotency, policy, audit and retries; it is not a simple webhook URL change. |
| Voice | ElevenLabs via n8n | Future separately evaluated voice provider; Retell remains parked | `start session`, `handle tool`, `ingest result`. Compare latency, tool reliability, telephony, recording policy and cost; no live-provider changes under this handoff. |
| Telephony/SMS | Twilio possibility | Other consented CPaaS/client telephony after verification | `send/place call/receipt/opt-out` adapters. Registration, region, numbers and opt-out behavior differ. Trial/free offerings are not production. |
| Calendar | Existing client calendar/provider | Google Calendar, Microsoft 365/Outlook, Cal.com; client scheduling tool | normalized availability/hold/confirm/cancel; preserve timezone, recurrence, resource and conferencing semantics. |
| Email | Client-approved transactional provider | verified SMTP/transactional APIs | templated idempotent send, delivery/bounce/complaint events; do not equate accepted with delivered. |
| Reviews/listings | Client-owned profiles + approved operational vendor if needed | platform-approved APIs or manual task generation | avoid scraping and unsupported automated posting. Vendor choice depends on locations and supported sites. |
| Ads | Client-owned Google/Meta accounts where appropriate | other ad platforms with approved APIs | read/report and separately gated proposals or changes; OAuth/scopes and terms verified. Media budget stays outside software fees. |
| Analytics | structured platform telemetry | PostHog or existing observability stack | only sanitized events; contractual DPA and tenant isolation; not needed before core acceptance. |
| Database/coordination | existing platform stores; PostgreSQL only if needed | managed PostgreSQL where approved | atomic lease/idempotency semantics, encrypted backups and migrations. Never replace Twenty business records with ad-hoc tables. |

Client Salesforce/HubSpot compatibility is a design option, not a connection requested or made here. For each synchronized field, declare `authority`, `direction`, `transform`, `conflict rule`, `external version`, `PBI/classification`, and `required/optional`. Proposed authority examples:

| Field | Authority when integrated | Twenty role |
|---|---|---|
| Client account/contact core fields | client CRM if contract says so | minimal operational projection, versioned |
| Opportunity stage/amount | client CRM unless Kynetic explicitly owns pipeline | read and react; no blind overwrite |
| Communication consent/suppression | most restrictive signal from all systems; Kynetic opt-out service denies immediately | union of denies, with provenance and dispute review |
| AI conversation summary/disposition | Kynetic automation | operational source; export approved summary only |
| Appointment time/state | calendar/scheduling provider | cached operational copy + revision |
| Campaign membership/journey lease | Kynetic coordinator | source for automation, not client sales stage |
| Ad spend/delivery | ad platform | attributed reporting snapshot with observation window |

Never allow “last write wins” to erase an opt-out. External sync conflict creates review if authority or revision is ambiguous.

### 6.4 Official free/open-source verification snapshot (checked 2026-11-06)

These are source-backed facts at research time, not price guarantees. Recheck before vendor selection; hosting, email delivery, telephony, model use, support and administration can cost money even when software is free.

- **n8n Community:** official docs describe self-hosted Community as free indefinitely under the Sustainable Use License. Internal business use, building client automations and charging for setup/maintenance are permitted when clients cannot create/edit workflows. Restrictions include offering n8n hosting for clients to build/configure workflows, white-labeling n8n as-is, and using paid features without the needed license. Community omits listed features such as external secrets, environments, projects and SSO; plan operations accordingly. Sources: <https://docs.n8n.io/n8n-community-license/community-license/license-faq>, <https://docs.n8n.io/deploy/host-n8n/community-edition-features>.
- **Twenty self-hosted:** official billing/legal docs say the free self-hosted edition includes Pro CRM features and custom roles, with AI using the user’s provider keys; infrastructure/support are not free. Code is mostly AGPLv3, some packages MIT, and some commercial. Premium features such as row-level permissions/SSO require an Organization license; review current license before modifying/redistributing. Separate front ends using published APIs have an exception per official legal FAQ, but legal review remains appropriate. Sources: <https://docs.twenty.com/user-guide/billing/how-tos/billing-faq>, <https://docs.twenty.com/user-guide/legal/how-tos/legal-faq>.
- **ElevenLabs:** official pricing lists a free Agents tier, but official legal guidance says the free plan lacks a commercial license and requires attribution for noncommercial publication. Beta services may not be used commercially or in production. Free minutes therefore support limited prototyping, not a production client receptionist. Current prices/minutes are deliberately omitted from this long-lived spec; check official pricing before modeling. Sources: <https://elevenlabs.io/pricing/agents>, <https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform>.
- **Twilio:** official trial documentation describes a time-limited trial with product-specific units, verified-recipient restrictions, geographic limits and predefined-content restrictions; trial phone resources are not a durable client communications setup. Use mocks for most tests and an approved sandbox for limited integration. Source: <https://www.twilio.com/docs/usage/trials>.
- **PostgreSQL:** permissive PostgreSQL License; retain license notices. This removes database license fees, not hosting/high-availability/backup operations. Source: <https://www.postgresql.org/about/licence/>.
- **listmonk:** official project describes self-hosted newsletter/mailing-list software and AGPLv3 licensing. It does not supply SMTP delivery or legal consent; n8n must still enforce journey policy and suppression. Sources: <https://listmonk.app/>, <https://listmonk.app/docs/>.
- **Cal.diy:** official docs describe MIT-licensed self-hosted scheduling but explicitly recommend it for personal/non-production use and do not guarantee safety/security. Its current community edition excludes teams/organizations, routing forms, workflows and other commercial functions, so it is **not the default production replacement** for multi-tenant client scheduling. Prefer existing client providers or a commercially supported Cal.com option after verification. Sources: <https://www.cal.diy/>, <https://cal.com/blog/cal-diy-open-source-to-closed-source>.
- **PostHog:** official product analytics page advertises a free event allowance, but event limits and pricing can change. It is optional; self-hosting/privacy and telemetry redaction require separate evaluation. Source: <https://posthog.com/product-analytics/pricing>.

Open-source dependencies must pass maintainability, security, upgrade and feature-fit checks. A free calendar widget cannot replace resource-aware, two-way synchronized appointment infrastructure. A free voice allotment cannot establish commercial viability.

---

## 7. Shared portal, backend and visibility model

There is **one shared base portal**, not a bespoke portal rebuilt for each system. Client UI presents operational state and safe commands; n8n performs orchestration headlessly; Twenty stores operational facts; external providers execute communications/calendar/ads under separately protected credentials.

### 7.1 Layer boundary

| Layer | Contains | Must never contain/do |
|---|---|---|
| Client portal UI | tenant-scoped dashboards, records, status, approved configuration forms, action confirmations and audit display | provider tokens, n8n credentials, hidden prompt logic, arbitrary JS workflow definitions, unrestricted URLs, direct browser-to-live-provider writes |
| Portal backend/API | authenticate user, authorize tenant/action, validate schema, issue idempotent command, query projections, sanitize responses | trust client-supplied tenant IDs/prices/roles; proxy arbitrary vendor endpoints; suppress opt-out behind a long queue |
| n8n/backend workers | verify events, normalize, coordinate, call adapters, write operational facts, retry/reconcile/meter | depend on portal browser sessions or DOM clicks; hold UI credentials; treat an HTTP 200 as business success |
| Twenty/data stores | field-level operational source, event history, consent/suppression, usage and command audit | store raw provider secrets or unnecessarily sensitive fields; serve as unvalidated public API |
| External apps | communication, calendars, external CRM, ads and profiles under least privilege | receive data without tenant policy; be called directly from client browser for automation writes |

Portal writes are **controlled commands**, not direct record editing of coordination state. Example: `POST /api/systems/quote-follow-up/actions/pause` is a logical desired route, not an implemented endpoint. The backend derives tenant from session, validates `opportunity_id`, requires a CSRF-safe authenticated request, stores an audit event, then calls a narrow internal command interface. It returns command accepted, not “automation paused” until a durable pause acknowledgment is observed.

Use separate service identities for portal backend → internal command API and n8n → Twenty/vendors. Prefer server-to-server short-lived tokens/mTLS/private networking where supported; rotate secrets and restrict egress. Public webhooks use provider signatures/replay controls and a separate unauthenticated-entry surface that performs verification before enqueueing. The portal session is not an n8n credential.

### 7.2 Proposed RBAC

| Role | Visibility | Controlled actions |
|---|---|---|
| Kynetic platform admin | cross-tenant health only through privileged internal view; audited support access | environment/tenant enable commands subject to approval; never visibility by default into all content |
| Kynetic operator | assigned tenants, failures, conversations, handoffs, usage | retry safe failures, release handoff, pause journeys; no production activation without approval |
| Tenant owner/admin | own tenant’s leads, appointments, outcomes, approved config and audit | invite users, approve business settings, pause own automation, resolve handoffs |
| Tenant sales user | assigned leads/opportunities/appointments/tasks | disposition, quote data, human takeover, schedule actions |
| Tenant front desk | inbound conversations, callbacks, appointments | reschedule/cancel through controlled flow, take over conversation |
| Tenant marketing | campaigns, attribution, presence/ads data appropriate to tenant | draft campaign inputs; publishing/ads changes separately gated |
| Read-only/viewer | explicitly permitted dashboards | no commands or exports unless separately granted |

Raw recordings/transcripts can contain sensitive information. Make them separately permissioned, time-limited where supported, audited and redacted in ordinary list views. Use Twenty custom roles where appropriate, but portal RBAC must independently enforce object, field and action permissions; hidden buttons are not security.

---
## 8. System build specifications

Each pack below is a bounded deliverable. Fields and statuses are logical proposals until mapped. Shared ingress, policy, adapter, audit, metering and testing artifacts are built once and reused.

### 8.1 Speed-to-lead Alex

**Outcome:** respond promptly to an eligible new lead, identify need and urgency, answer only approved questions, offer a valid next step, and transfer or summarize for a human when appropriate. “Fast” is measured from source occurrence and receipt to first accepted attempt; do not assert a guaranteed response time before load tests.

**Pack A — Text-first intake (MVP):** signed lead webhook/form adapter → normalize/dedupe → validate consent/DNC/owner eligibility/service area/hours → find existing active conversation → acquire lease → send approved consented acknowledgement → classify structured sandbox reply → book through scheduling or hand off. This proves coordination before voice.

**Pack B — Voice:** a net-new sandbox voice configuration, telephony adapter, outcome ingestion and tool mocks. Proposed call states:

```text
created -> queued -> dialing -> ringing -> connected | no_answer | busy | failed
connected -> disclosing -> discovering -> qualifying -> scheduling | transferring | closing
any state -> opted_out | human_requested | safety_exit | completed
no_answer/busy -> retry_eligible (policy) -> queued | exhausted
```

**Ordered logic:** dedupe source ID; suppress closed/won/lost unless new intent justifies entry; select channel/consent; call only during permitted time; provide required disclosure; capture service need, location, timing, preferred appointment and explicit callback permission; invoke narrow scheduling/handoff tools; emit outcome and lease release. If voicemail policy is not legally/operationally approved, do not leave AI voicemail by default. Cap retries per rolling window and channel, and stop after any meaningful reply.

**Voice/LLM responsibility:** spoken turn-taking, intent/slot extraction with confidence, approved knowledge responses, request tools, summarize outcome. **n8n responsibility:** lead policy, determining tools/arguments allowed, calendar validation, CRM state, retry and external side effects. LLM prose never directly writes stage or booking; tools return structured results and backend code decides.

**Proposed onboarding:** business greeting/disclosure; qualifying questions and required/optional slots; service/ZIP eligibility; minimum job types; estimated value ranges if voluntarily supplied; scheduling types; hours/transfer targets; emergency language; disallowed claims/financing questions; knowledge source; voice attempts; approved voicemail; recording disposition; caller ID; unknown-answer behavior.

**Data/events:** `lead.received`, `response.policy_decided`, `voice.attempted`, `voice.connected`, `lead.qualified`, `handoff.requested`, `appointment.changed`, `lead.dispositioned`; store transcript/recording reference separately with access class and retention. Fields include intent, urgency, service category, service address, qualification reason and outcome confidence.

**Proposed n8n boundaries:** `alex-intake`, `alex-policy`, `alex-dispatch`, `alex-tool-gateway`, `alex-result-ingest`, `alex-retry`, `alex-reconcile`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| New-lead queue, response state, qualification summary, approved appointment, failure reason and usage | intake, dedupe, policy, dispatch, tool gateway, result normalization, retry and summaries | Twenty lead/conversation/attempt/audit; ElevenLabs voice; possible Twilio; calendar adapter |
| Sales user can take over, edit disposition with reason, request callback; admin can pause tenant/system | backend command revokes lease and cancels releasable queued attempts before confirming pause | provider may be unable to cancel an already-started call; display actual state |

**Failures/handoffs:** immediate handoff for human request, anger, emergency, legal/pricing exception, repeated misunderstanding or low confidence. If transfer fails, capture callback preference and create high-priority task. Provider timeout after call request is reconciled before redial. Transcript failure does not erase call fact; store “summary unavailable.”

**Metrics:** eligible leads (denominator excludes duplicates/suppressed with reasons); attempted/eligible; connected/attempted; human-meaningful contact/eligible; qualified/connected; booked/qualified; median and p95 source-receipt-to-attempt; transfer success/requested; opt-outs/connected; cost per eligible lead. Attribution warns that booking is not won revenue.

**Sandbox tests/acceptance:** duplicate form events create one journey; late busy receipt cannot trigger duplicate; opted-out lead never calls; STOP between queue and transport blocks SMS; active Emily call denies Alex; won lead cancels retry; transferred call pauses outreach; unavailable calendar returns choices not hallucinated confirmation; tenant A cannot invoke tenant B tools; prompt-injection request for secrets is refused. Acceptance requires all expected structured outcomes and no external non-sandbox effect.

### 8.2 Inbound receptionist Emily

**Outcome:** answer routed inbound business calls, identify caller intent, resolve only approved requests, book/reschedule within scheduling policy, take a structured message, and transfer urgent/high-value requests. This spec does not authorize examining or modifying live Emily.

**MVP:** net-new sandbox receptionist with simulated inbound call, FAQ mock and message-taking. **Phase 2:** calendar tools/transfer. **Phase 3:** approved tenant knowledge and multilingual support only if quality-tested.

```text
inbound_received -> identifying -> intent_detection
  -> FAQ | scheduling | existing_customer_lookup | transfer | message_taking
  -> confirmation -> ended
any state -> human_requested | safety_exit | failed_handoff
ended -> after_call_summary -> eligible_transactional_followup | closed
```

Existing-customer lookup requires minimum verified identifiers, not caller ID alone for sensitive disclosure. Unknown callers receive only public/general scheduling data. Reception does not create duplicate lead if an existing person is confidently matched; uncertain identity creates review.

**Onboarding:** public greeting, services, hours, service area, escalation matrix, emergency instructions, transfer destinations and fallback order, FAQ approved answers, caller verification policy, appointment permissions, message recipients, recording/AI disclosure, maximum ring/transfer waits and spam policy.

**Records/events:** call/callback/message rather than always sales lead; link caller to existing opportunity when verified. `inbound_call.received`, `reception.intent_classified`, `message.created`, `transfer.result`, `appointment.changed`, `reception.completed`. Fields: callback number (confirmed), intent, urgency, summary, assigned team, consent for transactional followup.

**n8n boundaries:** `reception-inbound`, `reception-identity`, `reception-tools`, `reception-after-call`, `reception-transfer-fallback`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| front-desk call/message queue, transfer outcomes, callback tasks, approved FAQ status, recordings only if permissioned | inbound routing context, lookup, tool execution, transfer fallback, after-call event and dedupe | Twenty conversation/message/task; voice and telephony; external calendar |
| front desk can claim/complete message, invoke controlled callback or reschedule; admin changes approved FAQ via source configuration, not arbitrary prompt edit | takeover suppresses automated messages; command cannot unerase booking or transcript history | communication channel stays provider-controlled |

**Failures/handoffs:** caller says “person,” repeated silence/no-input, distressed caller, inaccessible knowledge, failed transfer. Never make emergency claims; play approved instruction. Summaries distinguish caller statement from confirmed business fact. Tool error gives honest fallback (“I can take a message”), not fake success.

**Metrics:** answered inbound calls offered to sandbox/new system; containment = calls completed without human / eligible answered; transfer success / transfer attempted; callback completion within SLA / messages due; booking accuracy / AI-booked; abandoned calls / offered; FAQ unsupported count. Avoid calling every short call “resolved”; sample quality reviews.

**Tests:** existing caller cannot retrieve private details using only spoofable caller ID; two inbound calls same caller do not merge appointments incorrectly; transfer timeout yields one task/message; Emily active prevents Alex/nurture; appointment cancellation respects revision; malicious caller asking for tool credentials gets none; no live Emily asset touched. Acceptance requires correct summaries, tenant routing and human fallback.

### 8.3 Missed-call text-back

**Outcome:** after an eligible business call is genuinely missed, send a consented, useful text that acknowledges the attempt and provides a reply/callback path. It does not answer the original call or use Emily/Alex unnecessarily.

```text
call.ended -> classify missed/abandoned -> cooldown/dedupe -> policy & consent
-> lease -> send -> awaiting_reply -> reply_classified -> handoff/scheduling/closed
-> no_reply -> exhausted (no unlimited cadence)
```

Exclude hangups before threshold, known spam, internal/test numbers, calls already handled by receptionist, successful transfers, repeats within cooldown and opted-out/unconsented destinations. “Missed” semantics depend on provider event verification. Do not infer promotional SMS consent merely because someone called; transactional content and consent posture require counsel-approved tenant policy. Replies can opt out or identify a wrong number at any point.

**MVP:** provider-event fixture and templated one-message transactional flow + human reply inbox. Later optional scheduling link only if safe. Onboarding: business name, missed-call thresholds, eligible numbers, template/locale, consent basis, cooldown, reply routing, hours and emergency disclaimer, fallback task owner.

**Records/events:** related inbound call ID, text attempt/provider ID, segment count, delivery, reply and suppression. `missed_call.detected`, `textback.decision`, `message.sent`, `message.delivered`, `message.replied`, `suppression.created`.

**n8n:** `textback-event-filter`, `textback-policy`, `textback-send`, `textback-reply`, shared `suppression-ingest`.

| Portal client UI | Headless backend | Data/external |
|---|---|---|
| missed calls, message status, replies and callback tasks; user claims reply or requests callback | classify, dedupe/cooldown, consent/policy check, send, ingest delivery/reply and lease | Twenty call/conversation/message/task; SMS provider |

**Failures:** if original call is later answered, pending text cancels. Replies go to a human unless an explicitly approved narrow scheduling automation handles them. Undelivered text creates retry only if provider semantics permit and no message may have been sent; permanent failure makes callback task. A delivery receipt is not a read receipt.

**Metrics:** provider-confirmed missed eligible calls; policy-eligible/missed; texts accepted/eligible; replies/delivered (with delivery unknown bucket); callbacks booked/replies; opt-out/replied; duplicate-suppression count. Median time to first response from missed-call event.

**Tests:** repeated provider webhooks send once; answered-later cancels queued text; same household shared number does not leak tenant context; STOP mid-flow suppresses all systems; Emily-handled call does not trigger text; unknown reply makes human task. Acceptance requires no more than configured messages and correct reply ownership.

---
### 8.4 Quote follow-up

**Outcome:** help a prospect make a decision after a real quote/estimate is issued, answer approved process questions, surface concerns and arrange the next human/appointment step. It must not invent discounts, change scope or repeatedly pressure someone who declined.

**MVP:** manual/CRM quote state + bounded approved messages + reply routing and expiry handling. Phase 2: document/status integration and structured objection summaries. Automated price or contract generation is excluded.

```text
quote.issued -> validate active opportunity/consent -> wait configured interval
-> before-send recheck -> follow_up_1 -> awaiting_response
  -> responded -> objection/intent -> human | scheduling | nurture (with permission)
  -> no response -> bounded follow_up_2 -> final_closeout (optional)
any state -> accepted | declined | quote_withdrawn | expired | opted_out | human_owned
quote.revised -> new revision + reset only under explicit policy
```

**Ordered branches:** accepted routes to onboarding, never another sales nudge; declined stores reason and stops; revision references latest quote and invalidates previous scheduled content; expiry offers human review rather than pretending offer remains open; active conversation/appointment suppresses reminders; explicit nurture permission is required before long-term marketing handoff. A lost opportunity remains closed unless new inbound intent occurs.

**Onboarding:** quote states/source and revision ID, issue/expiry dates, amount/currency if allowed, valid follow-up intervals and maximum attempts, approved channels/templates, scope questions/FAQs, discount authority (default none), sales owner, financing escalation and allowed closeout wording. Avoid putting full quote details in insecure channels.

**Records/events:** quote external ID/revision, opportunity, issued/expiry dates, outcome, reason, next follow-up, attempt sequence/version and owner. Events: `quote.issued`, `quote.revised`, `quote.followup_decided`, `quote.objection_classified`, `quote.accepted`, `quote.declined`, `quote.expired`, `quote.handoff`.

**n8n:** `quote-intake`, `quote-scheduler`, `quote-send`, `quote-reply`, `quote-state-watcher`, `quote-closeout`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| active quote/revision, stage, follow-up history/next eligible step, replies, objections and owner | quote validation, cadence, pre-send conflict check, reply classification, cancellation on terminal state | Twenty quote/opportunity/conversation/task; external estimate source if integrated |
| sales can take over, record accepted/declined, revise through authoritative source and pause with reason | portal command requests pause; workflow persists acknowledgment and cancels queued sends | no arbitrary browser-to-estimate tool writes |

**Failure/handoff:** quote total mismatch, ambiguous revision, legal/financing/discount request, angry reply or uncertain sentiment goes to human. Provider send timeout reconciles before repeat. Missing quote URL/details uses general callback wording rather than fabricated information.

**Metrics:** eligible quotes issued; follow-ups delivered/quotes eligible; meaningful replies/delivered; appointments/replies; accepted, declined and undecided within cohort windows as separately reported outcomes; median decision time; opt-out and complaint/delivered. Acceptance rate must inspect undecided/maturing cohorts and cannot claim automation-only causation.

**Tests/acceptance:** revised quote cancels old cadence; accepted between queue and send blocks message; lost quote receives no nurture without valid basis; two revisions cannot interleave; reply generates one owner task; human takeover persists across scheduled jobs; duplicate quote webhook one journey. Acceptance requires zero stale-quote messages in all fixtures and accurate terminal outcomes.

### 8.5 Old-lead / database reactivation

**Outcome:** reassess a bounded, lawfully contactable segment of dormant leads and create human conversations where there is current intent. It is a finite campaign with explicit entry/exit, not permission to upload or message a database indiscriminately.

**MVP:** synthetic import validation → eligibility report → client-approved segment and short campaign → replies human-owned. Production launch is separately approved after consent/DNC review. No blanket “old leads all get SMS.”

```text
source cohort -> dedupe -> historical terminal-state check -> consent/DNC/eligibility review
-> approved cohort -> per-channel cadence -> current_intent | no_intent | no_response
current_intent -> Alex/scheduling/human (one owner)
no_response -> exhausted; no automatic reentry
any state -> opt_out | wrong_person | disqualified | human_review
```

**Branches:** active opportunity or recent conversation excludes; previous opt-out/DNC/wrong number excludes; channel-specific valid basis and approved template required; new intent creates/opens an opportunity under CRM authority without erasing old outcome; no intent ends; source age alone never defines eligibility. Job/service history only used where accurate and permitted.

**Onboarding:** source fields and provenance, last-activity definitions, original consent evidence, suppression/DNC imports, dormant window, eligible pipeline outcomes, service categories and locations, message variants, campaign send windows/rate/caps, approver, reply staffing and exhausted retention/reporting.

**Records/events:** campaign/version, immutable cohort decision, eligibility reason code, last activity/original stage, new-intent result, source attribution, suppression. `reactivation.cohort_validated`, `reactivation.entry_approved`, `reactivation.attempted`, `reactivation.intent_detected`, `reactivation.exhausted`, `reactivation.suppressed`.

**n8n:** `reactivation-import`, `reactivation-audit`, `reactivation-cohort`, `reactivation-dispatch`, `reactivation-reply`, `reactivation-reconcile`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| cohort totals and exclusion reasons, approved template/version, actual campaign progress, replies and outcomes | source validation, dedupe, eligibility, lease/cadence, dispatch and reply routing | Twenty campaign/audit/conversation; approved channel adapter |
| authorized admin pauses cohort; operator claims replies; no arbitrary bulk launch button | each queued send rechecks current state; pause acknowledged by durable status | DNC/suppression evidence remains operational even when campaign ends |

**Failure:** uncertain consent defaults exclude; bounce/wrong person suppresses appropriately; provider throttle respects rate; new form fill cancels reactivation and moves to Alex; staffing cap defers sends rather than creating unmanaged replies.

**Metrics:** raw rows; unique people; excluded by reason; eligible/unique; attempted and delivered/eligible; meaningful reply/delivered; new qualified intent/replies; booked/qualified and won by matured cohort; opt-outs/complaints with channel denominator. Compare to a holdout when volume and consent permit, and report selection bias.

**Tests/acceptance:** global AM-1 suppression holds; FL/OK owner eligibility separate from service address; historical opt-out never reactivated; active quote excluded; duplicate source rows produce one entry; new intent transfers atomically to Alex; campaign pause prevents next sends. Acceptance requires cohort reconciliation (`raw = unique + malformed/duplicates`, and unique = eligible + excluded) with reason-code evidence and no real outreach.

### 8.6 Long-term nurture

**Outcome:** provide permissioned, relevant education/check-ins over time and recognize renewed intent, without colliding with sales or post-service journeys. Content is approved and cadence bounded.

**MVP:** audience rules + 2–3 approved evergreen messages + preference/opt-out + intent handoff. Dynamic AI-written outbound content is excluded until separately reviewed; AI may classify replies but cannot silently expand promises.

```text
explicit_entry -> validate consent/preferences -> choose content track
-> scheduled_item -> current-state/lease recheck -> send -> next_due
  -> engagement/intent -> handoff Alex/human/scheduling
  -> completed_track -> dormant_or_permissioned_next_track
any state -> unsubscribed | suppressed | bounced | active_sales | human_owned
```

Active Alex/Emily/quote conversations suppress nurture; won work exits sales nurture and only later enters appropriate customer journeys; unsubscribed applies at correct channel/purpose and suppresses all optional marketing under restrictive default. Click tracking needs privacy/consent review and is not a proxy for consent.

**Onboarding:** entry basis, audience/service tracks, approved content library/version/expiry, from identity, frequency/maximum, quiet hours, preference management, reply owner, intent taxonomy, bounce/complaint process and calendar seasonal exclusions.

**Records/events:** track/subscription, content version, schedule, engagement event source, preference and reason for exit. `nurture.enrolled`, `nurture.item_due`, `nurture.sent`, `nurture.replied`, `nurture.intent`, `nurture.exited`, `preference.changed`.

**n8n:** `nurture-entry`, `nurture-scheduler`, `nurture-content`, `nurture-dispatch`, `nurture-engagement`, `nurture-exit`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| track/membership, approved content/version, next step, engagement and exit reason | recurring selection, policy and cooldown, delivery, bounce/reply and handoff | Twenty subscription/content/attempt/event; email/SMS approved adapter |
| marketing edits drafts; only approved content becomes active; user can suppress contact | backend separates draft approval from send; live sends cannot be triggered by editing UI HTML | provider delivery/complaint signals ingested headlessly |

**Failure:** expired content pauses track; permanent bounce updates status and alerts; ambiguous reply human; duplicate workers lease same content item once. Portal outage never delays incoming opt-out ingestion.

**Metrics:** enrolled eligible people; active at start of period; delivered/enrolled due; replies/delivered; renewed intent/active exposed; appointments after intent; unsubscribe/complaint per delivered; content fatigue and track completion. Opens are unreliable due to privacy/image behavior and not a primary success metric.

**Tests/acceptance:** active quote cancels send; appointment due prioritizes confirmations; STOP/unsubscribe immediately blocks queue; re-entry obeys permission; content draft cannot send; duplicate schedule one attempt; bounce mapped correctly. Acceptance requires deterministic track state and a fresh intent handoff without duplicate lead/opportunity.

### 8.7 Reputation / review automation

**Outcome:** ask eligible customers for honest feedback through a neutral, compliant review request and track request outcomes. No positive-only targeting, review gating, fabricated reviews or routing private negativity away from public review options.

**MVP:** service-completion trigger + manual approved eligibility + neutral request + status/attribution report. Native review response drafting can be later phase, always human-approved.

```text
verified service completion -> eligibility/cooldown -> neutral review request
-> request delivered -> platform outcome observed (if supported) | no_observable_outcome
-> optional bounded reminder -> completed
any completion state -> opted_out | suppressed | service_job_reopened (pause new request)
feedback received -> service recovery task if appropriate (separate parallel path)
```

Review platform/policy eligibility, completion, consent and request frequency matter; **rating/sentiment must not determine whether someone receives the public review request**. Negative private feedback cannot be used to divert a reviewer away from an honest public-review path. An explicitly defined unresolved-service policy may defer a broader customer success campaign, but must never create selective public-review solicitation. Verify current platform anti-incentivization/gating rules with counsel/vendor documentation.

**Onboarding:** verified completion source, locations/review profile links, neutral template, sender identity, channel consent, wait/cooldown, request cap, incentive policy (default none), feedback escalation, response owner and platform terms checklist.

**Records/events:** completion/job ID, location, request revision, provider/review link, attempt/delivery and observable external review reference; private sentiment classified separately. `review.eligibility_decided`, `review.requested`, `review.feedback_received`, `review.observed`, `review.response_task`.

**n8n:** `review-completion`, `review-eligibility`, `review-request`, `review-feedback`, `review-reconcile`.

| Portal client UI | Headless backend | Data/external |
|---|---|---|
| campaign eligibility, actual completion evidence, click/review outcome, last-request date and suppression reason | state calculation, policy, tokenization, limited request, outcome reconciliation | Twenty job/customer/attempt; review profile/vendor adapter |
| owner sends no ad-hoc bulk blast; can suppress for lawful explicit reason or correct completion date | manual pause cancels queued requests; external review stays platform-authoritative | all portal roles see same neutral template; no sentiment-filter action |

**Failure:** missing profile link holds request instead of inventing URL; complaint creates service task but does not create review gating; click without observable review is not counted as a posted review; automated argumentative review response prohibited.

**Metrics:** verified completions; policy-eligible/completions; requests accepted/delivered; unique observable reviews/requested in a defined window; rating distribution where legitimately retrieved; request coverage by observable satisfaction segment to detect bias; complaint rate. Label attribution proxy when reviewer identity cannot be linked.

**Tests/acceptance:** positive and negative synthetic customers with equal operational eligibility get the same request; no private-feedback branch hides public link; cancelled job excluded; duplicate completion one request; policy-eligible unresolved-service handling documented and nondiscriminatory; opted-out never sends; no incentive/gating options. Acceptance requires neutral copy and coverage-by-segment audit proving no sentiment selection.

---
### 8.8 Referral automation

**Outcome:** invite eligible customers to refer someone, make voluntary submissions attributable without leaking customer data, and manage approved reward obligations. Referral eligibility is based on completed service, relationship/cooldown, channel policy and independent unresolved-service criteria—not positive ratings or favorable sentiment.

**MVP:** post-success request with optional human approval + sandbox referral landing form + notification + attribution. Preferred flow: the customer forwards a shareable link; the referee voluntarily submits their own details. Reward fulfillment/payment is a separate integration with financial approval.

```text
eligible customer & completion -> independent policy/cooldown -> referral invitation
-> awaiting voluntary referral -> referee self-submits + consent/eligibility
-> dedupe -> accepted new lead -> ordinary Alex/intake path
-> qualified/won observation -> reward_review -> approved/fulfilled (separate gate)
any invitation state -> opted_out | not_applicable | expired
submission -> invalid | existing_relationship | fraud_review | human_review
```

An unresolved complaint may defer referral requests only if the tenant has an explicit, uniformly applied service-recovery policy. It must remain independent of review-routing logic and must not be triggered merely by a negative review or sentiment score. A negative review alone never excludes referral eligibility. No contact of a referee based only on a third-party uploaded phone/email without verified lawful basis and consent process.

**Onboarding:** qualifying completed service types, cooling-off/cooldown, independent complaint/service-resolution statuses, consent channels, neutral invitation/share page, attribution window, existing-customer handling, reward eligibility/caps/terms, fraud rules and human reward owner. Legal/tax rules are reviewed outside engineering.

**Records/events:** referring person, completion, scoped unguessable token, referee voluntary source/consent, relation state, attribution touches, reward review. `referral.invited`, `referral.shared_clicked`, `referral.submitted`, `referral.accepted`, `referral.disqualified`, `referral.attributed`, `reward.review_requested`.

**n8n:** `referral-eligibility`, `referral-invite`, `referral-self-serve-intake`, `referral-dedupe`, `referral-attribution`, `referral-reward-review`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| invitation status, voluntary submissions, match/conflict queue, attribution and reward review | eligibility/cooldown, token checks, consent checks, dedupe, attribution and tasks | Twenty referral/opportunity/event; owned landing-page backend |
| owner approves reward with reason; staff resolves existing-lead conflict | no payout or referee outreach simply from portal button; commands invoke audited narrow workflows | original lead source retained; new referral touch appended |

**Failure:** self-referral, existing active lead, token tampering, duplicate submissions and suspicious burst go review; existing original source never overwritten; referral invitation stops upon relevant opt-out. Payment/accounting is absent unless separately integrated.

**Metrics:** operationally eligible customers; invitations delivered; voluntary referral submissions / delivered; accepted/submitted; qualified and won/accepted by cohort; reward liability and fulfillment; fraud-review rate. Coverage must be audited across satisfaction segments to ensure no hidden review gating.

**Tests/acceptance:** negative-review customer otherwise eligible follows same referral branch as positive-review customer; unrelated unresolved-service rule applies uniformly; no third-party referee message absent consent; token cannot cross tenant; duplicate/self-referral handled; existing lead preserved; reward cannot auto-settle. Acceptance requires voluntary-consent provenance and unbiased eligibility fixtures.

### 8.9 Customer maintenance / service reminders

**Outcome:** remind eligible customers of contract/manufacturer maintenance, warranty inspections or seasonal service and enable a request to book. For HVAC/pool services, recurring maintenance may fit; for remodelers, warranty check-ins may be more appropriate.

**Scope ambiguity:** this defines customer-facing reminders. Original prior intent could not be recovered. Internal platform updates/backups/monitoring are Section 9, not part of this automation. First onboarding decision chooses plan type: recurring service, warranty/seasonal check-in, or disabled for the niche.

**MVP:** curated service plans + one reminder + reply/booking task. Phase 2: recurring agreements, rescheduling and technician routing. No unapproved DIY/safety advice or contract/billing claims.

```text
plan.created or service.completed -> compute due window -> validate history/eligibility
-> pre_due_reminder -> awaiting_customer
  -> booking_requested -> scheduling
  -> callback_requested -> human
  -> snoozed -> recheck at chosen safe date
  -> declined/not_applicable -> no further reminder of same category
-> due/overdue -> bounded reminder if permitted
completed -> next recurrence exactly once | plan_ended
```

Use local service timezone and explicit recurrence semantics. Transactional service notices vs marketing need distinct approved policies; declining marketing is not automatically cancelling contract-required notices. Unknown histories default review, not “overdue.” Appointment pending suppresses book-now prompts.

**Onboarding:** plan/service categories; anchor and interval; service-history source; warranty end; approved notice category/copy; advance windows/cadence; snooze/decline behavior; customer timezone; seasonal rules; eligible resources; prices only if source verified; plan cancellation and service staff owner.

**Records/events:** asset/plan minimum necessary fields, interval/version, last/next service, reminder instance, preference, appointment. `maintenance.plan_created`, `maintenance.due`, `maintenance.reminded`, `maintenance.snoozed`, `maintenance.declined`, `maintenance.completed`, `maintenance.plan_ended`.

**n8n:** `maintenance-due-scanner`, `maintenance-policy`, `maintenance-reminder`, `maintenance-reply`, `maintenance-completion-reconcile`.

| Portal client UI | Headless backend | Data/external |
|---|---|---|
| plans/assets, service dates, due/overdue list, reminder instance, source state and appointment | date computation, dedupe, policy, reminders, completion reconciliation and recurrence | Twenty plan/asset/customer/history; calendar/channel adapters |
| service staff correct date with reason, snooze/not-applicable, request booking or claim reply | corrections create revision/recompute next date without deleting history | calendar remains booking authority |

**Failure:** bounced service-critical reminder makes task; conflicting completion IDs review; missing timezone defers optional marketing; stale reminder queue checks new completion/appointment immediately before sending; no infinite recurrence after plan termination.

**Metrics:** active eligible plans; due in window; reminded/due; booked/reminded; completed/reminded (keep separate); opt-out/snooze; corrected due-date / due calculations; overdue snapshot. No “incremental revenue” without comparison design.

**Tests/acceptance:** month-end/leap-year/DST recurrences; same scanner twice one reminder; completion cancels queue; reschedule changes linked appointment; snooze honored; service notice vs marketing classification respected; unknown history review; all date and tenant calculations deterministic. Acceptance requires a recurrence-version audit and correct next instance exactly once.

### 8.10 One CRM deliverable (configurable scope)

**Outcome:** create a usable revenue pipeline, adopted processes and reliable operational data for automations. This is one CRM engagement, configured by needs—not Lite and Full products.

**Configurable effort bands, not commercial tiers:** (a) core pipeline/users/import; (b) cleanup/migration/reporting; (c) existing Salesforce/HubSpot/etc. integration. Custom applications and complex transformation are separate.

```text
discovery -> field authority & role map -> source data quality/migration plan
-> sandbox metadata validation -> synthetic sample import -> reconciliation
-> user acceptance with fake data -> separately approved actual configuration/migration
-> adoption/reconciliation -> change control
```

No Twenty REST `DELETE`. Unknown real migration is not part of this task. Do not create custom fields before metadata read and approved delta. Client data remains exportable.

**Onboarding:** users/roles; companies/people; pipeline/stage entry/exit; job/opportunity distinction; routing/ownership; currencies/timezones; consent provenance; duplicate/survivorship; legacy IDs; report definitions; sync field authority; retention/export; required vs optional values; sensitive fields not to copy; sandbox destination.

**Artifacts:** evidence inventory; metadata decision record; field dictionary; local CSV/Markdown mapping (no Google Sheets); fake migration fixtures; role matrix; validation/reconciliation reports; SOP/training; supported export; disable/rollback plan that uses no delete.

**Records/events:** company/person/opportunity/activity, stage history, source touch, external ID/version, consent/suppression, appointments and handoffs. `crm.metadata_validated`, `crm.record_validated`, `crm.duplicate_flagged`, `crm.sync_conflict`, `crm.mapping_approved`, `crm.reconciled`.

**n8n:** `crm-metadata-validator`, `crm-source-ingress`, `crm-normalize-dedupe`, `crm-sync-out`, `crm-conflict`, `crm-reconcile`. Native administration/database tooling may be safer than n8n for some configuration and must be selected after inventory.

| Portal client UI | Headless backend | Data/external |
|---|---|---|
| pipeline/record projection or native CRM link, assignment, source, sync health and tasks | mapping validation, normalize/dedupe, sync, conflict/drift detection, audit | Twenty operational record; external CRM field authority per mapping |
| sales edits owned business fields; operator resolves duplicate/conflict; mapping changes reviewed | read-only source fields reject edits; no cross-tenant merge; only backend-controlled sync | Salesforce/HubSpot compatibility is not connected/installed for template build |

**Failure:** unknown picklist quarantines; API/edition limits recorded; external outage bounded queue; conflicting ownership human review; restrictive opt-out wins over stale subscribed state; partial migration never reported complete.

**Metrics:** active users; import records passing required fields/import attempted; duplicate review rate; sync success/attempted; median/oldest conflict age; open opportunities with next activity; stage aging; conversion by cohort with no guaranteed revenue claim.

**Tests/acceptance:** repeated source no duplicate; read-only external stage protected; stale revision no regression; forbidden sensitive field not copied; opt-out survives all sync; no `DELETE` request emitted; tenant isolation; field mapping rejects unsupported endpoint; synthetic import totals reconcile and export works. Acceptance requires approved mapping and role tests, not merely a populated CRM.

### 8.11 Scheduling

**Outcome:** offer valid windows, book/reschedule/cancel exactly once, synchronize calendar and Twenty, and give voice/text/human channels one appointment truth.

**MVP:** one fake tenant/resource/type and fake calendar adapter + controlled reminders. Phase 2: real client provider in approved sandbox, multi-staff. Travel/team routing is phased complexity.

```text
intent -> appointment type/resource -> fresh availability -> offer expiring windows
-> selection -> resource lock + revalidation -> provider confirm
-> confirmed -> reminders -> completed | no_show | cancelled | rescheduled
selection conflict -> alternatives
provider unknown -> reconcile_by_command_or_external_id -> confirm/retry/human
```

Always store full timestamp + IANA timezone. Voice can offer only backend-returned slots. Reschedule uses same appointment ID/revision. Cancellation ambiguity goes human/confirmation. Reminders cancel/reschedule with appointment changes. Detect provider echo without ignoring legitimate external edits.

**Onboarding:** provider/read-write calendars; included busy calendars; resource/team rules; appointment duration/buffer; service area/travel; hours/holidays/timezones; minimum notice/horizon; owner/round robin; cancellation/no-show policy; reminder cadence; conference/venue and external webhook semantics.

**Records/events:** external appointment ID/revision, person/opportunity, resource, start/end/zone, state, source and command history. `availability.offered`, `appointment.selected`, `appointment.confirmed`, `appointment.rescheduled`, `appointment.cancelled`, `appointment.completed`, `appointment.no_show`, `appointment.conflict`.

**n8n:** `schedule-intent`, `schedule-availability`, `schedule-book`, `schedule-event-ingest`, `schedule-reminders`, `schedule-reconcile`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| tenant appointment/resource view, booking source/state/revision, conflict and reminder result | availability, locks/idempotency, provider commands, event ingest, reminders and reconciliation | Twenty appointment projection/history; calendar authority externally |
| front desk/sales authorized reschedule/cancel with confirmation | backend revalidates slot/role; arbitrary provider payload rejected; no browser credential | customer self-service token only if separately built, scoped and expiring |

**Failure:** timeout reconciles before retry; permission revoked disables affected writes; resource unavailable releases lock; unknown external event review; no silent duplicate. No-show relies on staff/provider evidence not inference alone.

**Metrics:** intents; offers/intents; confirmations/offers; conflicts/attempts; provider sync lag; cancellations/no-shows among appointments due in matured period; booking source. Distinguish confirmation from completed appointment.

**Tests/acceptance:** two simultaneous same selections yield one confirmation; stale offers revalidate; timeout no duplicate; DST and leap day correct; reschedule one ID with history; cancellation stops reminders; Tenant A cannot access B calendar; all confirmation states reflect actual fake provider acknowledgment. Acceptance requires concurrency and reconciliation test evidence.

### 8.12 Online presence

**Outcome:** maintain accurate public profiles/listings and useful local presence with approved changes; report visibility/actions without promising rankings. Not unlimited SEO, website design or review manipulation.

**MVP:** baseline business/profile inventory → canonical facts → discrepancy report → client approval queue → manual/API-supported update tasks → verification and UTM capture. Unsupported scraping/posting prohibited. Preview-only websites; DNS always separate yes.

```text
baseline -> canonical business facts approved -> inventory external profiles
-> discrepancy -> proposed change -> client approval -> supported update/manual task
-> verification -> periodic monitoring/reporting
profile suspension/ownership issue -> human task
```

**Onboarding:** public legal/display name, address or service-area privacy choice, phone/domain/hours/holidays, category/services/location, photo/content rights, profile owners/access, tracking conventions, brand rules, approval owner, provider API capabilities and site boundaries.

**Records/events:** location, canonical fact version, profile reference, observed snapshot/time, discrepancy, proposal, approval/evidence/status. `presence.baselined`, `presence.discrepancy`, `presence.change_proposed`, `presence.change_approved`, `presence.change_verified`, `presence.profile_alert`.

**n8n:** `presence-baseline`, `presence-monitor`, `presence-change-request`, `presence-verify`, `presence-report`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| locations, approved canonical facts, profile inventory, discrepancy/change approval and verification evidence | scheduled comparison, task/proposal creation, approved adapter call, reporting and UTM consistency | Twenty projections; client profiles/vendor tools; source analytics externally |
| owner approves profile proposal; marketing can draft, not bypass approval | no automatic unsupported publishing or DNS; portal browser never holds vendor token | externally reported calls/directions/site visits retain their own definitions |

**Failure:** ownership verification becomes task; duplicates/suspension not automatically resolved; conflicting facts hold pending owner; metrics timestamped and not extrapolated. Bespoke website/copy changes separate scope.

**Metrics:** locations with baseline/total; verified profile fields/intended; discrepancies resolved with evidence/proposed; provider actions by source; attributed leads with known/unknown sources; no rank or causation guarantee.

**Tests/acceptance:** hour change creates proposal only; approval gates enforced; location A facts cannot affect B; missing provider API creates manual task; UTM deterministic; DNS/site production operation impossible in sandbox; all sandbox verification evidence links correct profile/revision. Acceptance requires before/after evidence and supported API/manual boundary.

### 8.13 Ads management and tooling

**Outcome:** reconcile ad delivery/spend to lead quality and business outcomes, detect anomalies and propose controlled actions. Client media spend is separate. The tool is not an autonomous unlimited-budget optimizer.

**MVP:** read-only sandbox connector → normalized reporting → UTM/lead reconciliation → anomaly/recommendation queue. No auto budget/publish/pause. Actual ad writes are a later separately approved scoped capability.

```text
account authorized -> read-only baseline -> campaign/naming/UTM/currency conventions
-> scheduled metrics ingestion -> freshness/reconciliation checks
-> anomaly/recommendation -> human proposal -> separate approval if change in scope
-> provider action -> verification
lead source touch -> CRM disposition -> matured cohort quality report
```

**Onboarding:** client-owned account/access, platforms/objectives, locations/services, timezone/currency, budgets/caps and owner, creative rights/claims, approval authority, landing-page scope, lawful tracking/offline conversion basis, attribution windows, exclusions and spend fee separation.

**Records/events:** external account/campaign/ad IDs, observed metric/date range/currency, lead touches/click IDs if lawful, proposal/approver/action receipt. `ads.snapshot_ingested`, `ads.anomaly_detected`, `ads.change_proposed`, `ads.change_approved`, `ads.change_verified`, `ads.lead_reconciled`.

**n8n:** `ads-auth-health`, `ads-read-connector`, `ads-normalize`, `ads-anomaly`, `ads-approval`, `ads-verify`, `ads-attribution`.

| Portal client UI | Headless n8n/backend | Data/external |
|---|---|---|
| data freshness, spend/leads/outcomes, anomalies and proposal audit; unknown data visibly unknown | read ingestion, normalization, reconciliation, thresholds and gated adapters | ad platforms authority for delivery/spend; Twenty for lead/outcome touches |
| role-gated review; any later change has independent budget/action allowlist and approval | default scope denies all writes; browser never holds ad token or directly publishes | offline conversion upload separately approved/consented and deduped |

**Failure:** revoked token alerts; tier/API limits documented; date/timezone/currency mismatch quarantines; duplicate daily metrics do not sum; unknown outcomes not zero; conversion consent and dedupe checked.

**Metrics:** platform spend for same range/currency; known leads and source coverage; cost per known attributed lead = spend/known attributed leads with caveat; qualified/known leads; won/qualified by matured cohort; freshness and reconciliation percentage. Pipeline is not realized return; no ROI guarantees.

**Tests/acceptance:** read-only credential cannot mutate; UI-injected action denied; duplicates not double counted; currencies/quarters/timezones align or quarantine; unknown revenue stays unknown; proposed change cannot run in MVP; media spend not counted as usage credits. Acceptance requires source definitions/freshness and a separate service-versus-spend report.

---
## 9. Internal Kynetic platform maintenance (operational service, not customer reminders)

**Outcome:** keep the shared automation estate secure, reliable and supportable. This is a bounded managed operations scope, not unlimited development or guaranteed uptime.

### 9.1 Included operational categories

- Inspect n8n execution failures, queue age, credentials expiry and provider webhooks.
- Monitor Twenty/API/database health, backup success and restoration drills using approved non-destructive methods.
- Review capacity/usage/tenant caps and suspicious traffic/spend patterns.
- Patch and upgrade dependencies in isolated staging with test evidence, rollback plan and approved deployment window.
- Rotate/revoke credentials through approved secret systems; audit least privilege and departed-user access.
- Maintain workflow/template version compatibility, release notes and configuration migrations.
- Reconcile provider and Twenty state; process dead letters with current policy recheck.
- Review suppression/audit integrity, log retention/redaction and cross-tenant anomalies.
- Maintain runbooks, known-error library, support SLAs and monthly service report.

**Exclusions unless separately scoped:** new features, new niches/channels, major migrations, client custom reports, content/ad management, onsite work and 24/7 response.

### 9.2 Maintenance state and workflows

```text
scheduled check / telemetry alert -> classify severity & tenant impact
-> known safe remediation in staging -> test -> approved deployment window
-> verify business health -> close with audit
unknown/high-risk -> pause affected net-new automation if authorized -> human escalation
backup alert -> inspect -> synthetic restore drill in isolated environment -> evidence
```

Paused automation must not stop opt-out ingestion or suppress safety controls. Incident severity determines communication/escalation policy. No incident notification is sent by this documentation task.

### 9.3 Portal/backend boundary

| Client portal UI | Internal operator portal | Headless backend |
|---|---|---|
| service status limited to own tenant, scheduled maintenance notice, affected capability and resolved incident summary | cross-tenant assigned health, sanitized errors, queue/retry detail, component/version and audit | health checks, backup monitors, reconciliation, safe release orchestration and metering |
| client cannot restart n8n, execute workflow or restore database | operator commands have MFA/RBAC, reason/approval, narrow allowlist and audited result | no arbitrary command execution or secret echo in UI |

**Records/metrics:** `maintenance.incident_detected`, `maintenance.change_verified`, `maintenance.restore_tested`, `maintenance.credential_expiring`; availability by agreed measurement, incident MTTA/MTTR, execution success, queue age, backup restore test success, overdue patches and recurring incident count. Maintenance is not evidence of client revenue.

**Sandbox acceptance:** synthetic error correctly classified; retry current policy; client cannot invoke operator action; expired test credential alert; backup drill evidence without exposing data; no Twenty delete; no workflow auto-activation after restore/deploy. Live production maintenance behavior requires separate operational acceptance.

## 10. Portal deliverables and integration scope

### 10.1 Standard shared portal integration

The base integration should provide common shell, tenant/auth context and reusable components:

1. **Home/outcomes:** fresh data timestamp, enabled-system status, eligible funnel and caveated metrics.
2. **Inbox/handoffs:** assigned conversations, replies, human ownership, tasks and failure reasons.
3. **Pipeline/appointments:** Twenty projections with links/actions permitted by authority and role.
4. **Journeys:** current system/state/next step/suppression reason without hidden prompt details.
5. **Settings:** business hours, service area, approved content/config through validated forms. No direct workflow-code editing by clients.
6. **Usage:** minutes, SMS segments, model/tool units, cap states and estimated-vs-actual markers.
7. **Audit/support:** command/change history and sanitized integration health.

Each system uses these components, not a new portal project. Minimum per-system widgets are the tables in Section 8. Portal integration starts only after the independent automation contract tests pass.

### 10.2 Backend endpoint contracts (illustrative, not existing APIs)

- `GET /api/tenant/systems/{system}/summary?range=...`: server derives tenant; validated range; returns facts + source timestamps + denominator definitions.
- `GET /api/tenant/handoffs/{id}`: field/role filtering; no secret/raw vendor payload.
- `POST /api/tenant/systems/{system}/pause`: requires reason, expected config revision, CSRF protection and idempotency key; returns command status.
- `POST /api/tenant/conversations/{id}/takeover`: optimistic conversation version, role check; sets human lease atomically.
- `POST /api/tenant/appointments/{id}/reschedule`: structured desired window; backend checks policy/fresh availability.
- `POST /api/internal/commands/{id}/ack`: authenticated n8n service identity, tenant/command allowlist; no browser access.

No route is assumed implemented. Use existing app conventions after read-only inventory. Provide OpenAPI schema only if that matches actual architecture; otherwise document versioned JSON Schema and tests.

### 10.3 Bespoke client portal

A custom portal with client-specific dashboards, roles, customer accounts, bespoke workflow UIs, nonstandard data collection or embedded product experience is separately scoped. Required discovery: user roles/tenancy, workflows, design system, accessibility, nonfunctional requirements, fields/data classifications, external app integration, export/retention, hosting/maintenance and acceptance. It is not assumed priced or included with the systems above, and it must not become a dependency for core n8n execution.

## 11. Custom AI, back-office automation and full transformation services

These are **broad service categories**, not fixed-scope products with unlimited processes.

### 11.1 Custom AI systems

Examples requiring discovery: approved estimating copilots, proposal drafting, document classification, dispatch recommendations, internal knowledge assistants, warranty/claims triage or job-photo summarization. Each needs:

- explicit user/decision owner, task boundary and excluded high-risk decisions;
- approved source corpus, retrieval/update ownership and data classification;
- deterministic tools with validation vs generative suggestions;
- confidence/uncertainty behavior and human review;
- evaluation set with ground truth, adversarial cases and unacceptable-output tests;
- audit/versioning, usage caps, feedback and correction process;
- separately priced build/support/usage based on scope.

No autonomous contract promises, discounts, hiring/firing, safety-critical decisions or legal/financial representation. AI output must not enter client communications or operational records as fact without the required verification.

### 11.2 Back-office automation

Potential individual automations, separately inventoried and accepted: invoice/document intake, job-status update routing, follow-up tasks, internal daily digest, file/photo organization in an approved client system, vendor/order-status extraction or payroll/accounting handoff drafts. Accounting/payment actions remain human-approved unless specific safe scope is granted. Do not use Google Drive/Docs/Sheets for Kynetic; client-owned system compatibility still requires intentional scope and does not displace Twenty.

Each recipe must name trigger, authoritative input/output, field mapping, reviewer, failure recovery, audit, access, metrics and tests. “Back-office automation” is a discovery family, not permission to access all business systems.

### 11.3 Full AI transformation

A transformation engagement is a program made of individually bounded workstreams, not a magical package:

1. **Discovery:** process map, roles, baseline volume/time/quality, systems/data access, eligibility, consent/security and constraints.
2. **Prioritization:** value vs complexity/risk; identify measurable candidate workflows and exclude unsafe use cases.
3. **Data/integration foundation:** field authority, identity, least privilege, event taxonomy, sandbox and export/retention.
4. **Pilot workstreams:** one or a few systems with explicit user groups and acceptance thresholds, not every department at once.
5. **Process & change management:** SOPs, training, human ownership, feedback, adoption measurement and escalation.
6. **Controlled rollout:** site/department waves with exit criteria and rollback; approvals for every production activation.
7. **Stabilization:** observation, cost/quality reconciliation, user acceptance and operational handoff.
8. **Continuous backlog:** maintenance vs enhancements governed separately.

Boundaries must state included departments/processes/locations, number of workflows/integrations, training sessions, content/output responsibilities, support window and out-of-scope change requests.

### 11.4 On-site rollout

On-site work is separately scoped travel/logistics and implementation support: stakeholder interviews, workflow observation, device/network/readiness review, staff training, supervised sandbox rehearsal and go-live support after approvals. Client provides safe access, local decision makers and facilities. Travel dates/costs, site count, attendees, materials and safety/access rules must be written in the statement of work. No on-site production activation is implied here. Remote-first pilot is the proposed default; on-site occurs when observation/training materially benefits.

## 12. Practical build sequence and reusable recipes

### 12.1 Per-system software/artifact recipe

| System | Reusable software/template components | Initial provider stance |
|---|---|---|
| Alex | lead ingress, policy, conversation lease, voice adapter/tool schemas, scheduling/handoff, result parser | mock ElevenLabs + telephony; net-new sandbox later, never live Alex |
| Emily | inbound event, caller/identity adapter, FAQ source schema, message/transfer/handoff, after-call parser | simulated inbound and net-new sandbox only; live Emily prohibited |
| Missed-call text-back | call-ended filter, cooldown, SMS adapter, reply/suppression inbox | fake provider webhooks/SMS; approved Twilio sandbox only later |
| Quote follow-up | quote intake/revision/cadence state machine, template renderer, reply handoff | synthetic quote fixtures + mock channel |
| Reactivation | source validation, cohort/report builder, exclusion reasons, campaign dispatcher | fake CSV/JSON + mock channel; no real database upload |
| Nurture | track/subscription/content version scheduler, preference/bounce ingest | mock email/SMS; listmonk optional only after fit review |
| Review | completion intake, unbiased eligibility/neutral content, request/reconcile | fake profiles/jobs; no review-platform posting |
| Referral | share token/form schema, voluntary-consent intake, dedupe/attribution/reward review | local fake form and users; no payments |
| Customer maintenance | plan/recurrence engine, due scanner, reminders, completion reconcile | synthetic plans/calendar/channel |
| Unified CRM | metadata diff/field map, fake migrations, validation/reconciliation, sync adapters | existing Twenty read-only inventory; no Salesforce/HubSpot install |
| Scheduling | normalized provider adapter, availability/lock/idempotency, appointment projections/reminders | fake calendar first; real existing client provider only approved sandbox |
| Online presence | canonical location/profile fact model, discrepancy/proposal/verification tasks | fake profile stores; no live listing/DNS/publish |
| Ads | read connector contract, snapshot normalization, anomaly/proposal/attribution | sandbox/read-only later; zero live ad writes in MVP |

All initially use the shared n8n base workflow, Twenty logical schemas, JSON Schema fixtures, TypeScript/Vitest contract harness as proposed, and portal read/command contracts. Vendor replacement occurs behind adapters, not by forking every system.

### 12.2 Suggested phases

**Phase 0 — Read-only discovery and harness (no implementation against services):**

- inventory artifacts and actual versions; identify repository conventions;
- write source/status matrix and risk register;
- create local schemas, fake providers, fixture generator and cross-tenant assertions;
- decide lock/idempotency implementation with failure tests;
- handoff checkpoint: inventory evidence + executable fake-event harness plan.

**Phase 1 — Foundation template, isolated branch only after required approval:**

- shared ingress/dedupe/policy/suppression/lease/Twenty adapter/metering/error workflows;
- fake lead-to-text acknowledgement and fake booking end to end;
- tenant clone from fake A to fake B without copying credentials/data;
- exit: shared tests green, all workflows inactive, no external sends.

**Phase 2 — First revenue-response slice:**

1. Missed-call text-back because it has a narrow trigger and one bounded message.
2. Alex text intake/prototype, then voice sandbox only after shared reliability passes.
3. Scheduling fake adapter and one-resource contract, shared by both.
4. Emily sandbox reception/FAQ/message flow and transfer fallback as a separate net-new configuration.

Why this order: it establishes intake, suppression, replies, scheduling and human handoff before adding autonomous cadence. It does not assert a required business-priority order if Abdullah chooses otherwise.

**Phase 3 — Pipeline and core records:**

- unified CRM metadata/migration/fake external CRM adapters;
- quote follow-up and terminal-state cancellation;
- shared pipeline metrics and portal read projections.

**Phase 4 — Bounded audience systems:**

- nurture and then reactivation (reactivation after consent/cohort audit proves robust);
- reputation with explicit anti-gating tests;
- referral with voluntary-referee intake;
- customer maintenance with recurrence tests.

**Phase 5 — Operational visibility/acquisition:**

- online presence baseline/approval tasks;
- ads read-only reporting/anomaly proposals;
- usage dashboards, operator tooling and standard portal integration across all accepted systems.

**Phase 6 — Client sandbox pilot and production decision package:**

- one explicitly approved fake/sandbox tenant, limited synthetic/allowlisted destinations;
- validate onboarding duration, data export, runbooks, RBAC, load/caps and restore;
- no production activation until its own explicit yes names scope.

Later phases: multi-location and custom transformations; per-site overrides and centralized reporting need additional tenancy/RBAC tests. Do not force a complex multi-location hierarchy into MVP before fixture-backed requirements.

### 12.3 Template-cloning configuration procedure

1. Receive approved business configuration using schema-validated file/UI export stored in the approved repository/system—not Drive/Sheets.
2. Validate eligibility, canonical timezones, external sources, roles, consent terms and URLs.
3. Resolve tenant-specific credential **references** server-side; do not export/copy secret values.
4. Instantiate from pinned template version; map opaque IDs with generated deployment manifest.
5. Run metadata preflight read-only; fail on missing fields/mappings.
6. Run contract suite with fake providers and tenant-specific fixtures.
7. Run optional approved sandbox read tests, then bounded allowlisted writes only if granted.
8. Keep inactive; produce config diff, unresolved items, cap estimates and rollback plan.
9. Optimize prompts/content/cadence with test evidence for 1–2 days as a target; no performance guarantee.
10. Seek explicit activation approval with exact workflows/agents/tenant/time.

## 13. Per-system Definition of Done checklist

Every box means test evidence in the isolated branch/sandbox, not just a written workflow.

| System | Required additional DoD beyond shared Section 5.4 |
|---|---|
| Alex | [ ] qualification slots validated [ ] tools cannot bypass policy [ ] transfer/timeout/low-confidence paths [ ] attempt caps [ ] net-new sandbox only [ ] duplicate/live-conversation suppression [ ] voice transcript summary accurately distinguishes facts |
| Emily | [ ] inbound FAQ/unknown-answer tests [ ] callback confirmation [ ] identity-limited disclosure [ ] transfer failure fallback [ ] message ownership [ ] live Emily untouched |
| Text-back | [ ] verified missed-call classification [ ] duplicate/cooldown [ ] answer-later cancellation [ ] one bounded template [ ] reply claim/opt-out immediate [ ] delivery not equated to read |
| Quote | [ ] revision/expiry correctness [ ] accept/decline cancels queue [ ] no discount fabrication [ ] reply objection handoff [ ] active conversation suppression [ ] cohort reporting |
| Reactivation | [ ] lawful cohort evidence and approved exclusions [ ] global/client DNC [ ] owner-geography eligibility [ ] historical terminal states [ ] finite campaign/caps [ ] new-intent handoff [ ] reconciliation report |
| Nurture | [ ] explicit subscription/entry [ ] approved content versions [ ] channel preference/unsubscribe [ ] active-sales exit [ ] bounce/reply intent [ ] no auto-send drafts |
| Review | [ ] neutral request [ ] equal positive/negative eligibility [ ] no review gating/incentives [ ] verified completion [ ] request idempotency/cooldown [ ] observable-outcome attribution caveat |
| Referral | [ ] eligibility independent of review sentiment [ ] separate uniformly applied service-recovery rule if any [ ] referee voluntary consent [ ] safe tokens/dedupe [ ] existing source preservation [ ] reward human approval |
| Maintenance | [ ] niche interpretation confirmed [ ] recurrence timezone/date tests [ ] snooze/not-applicable/cancel [ ] completion reconciliation [ ] unknown history review [ ] approved service/marketing content category |
| Unified CRM | [ ] approved field/role/authority matrix [ ] no forbidden data [ ] synthetic migration reconciliation [ ] safe duplicate workflow [ ] export [ ] stale sync/opt-out/no-delete tests [ ] user adoption SOP |
| Scheduling | [ ] concurrent booking test [ ] provider timeout reconciliation [ ] revision-preserving reschedule [ ] cancellation/reminders [ ] DST/timezones [ ] scoped calendars and tenant isolation |
| Online presence | [ ] canonical facts/location roles [ ] change approval/verification [ ] no unsupported publish [ ] manual fallback [ ] source freshness [ ] no DNS or live deploy |
| Ads | [ ] read-only MVP [ ] spend/report timezones/currencies [ ] dedupe/data freshness [ ] unknown outcomes [ ] no ad write [ ] media spend separate from usage [ ] no ROI claim |

## 14. Final engineering, security and acceptance checklists

### 14.1 Shared code/workflow review

- [ ] Each workflow disabled by default and labeled environment/system/tenant template.
- [ ] All external HTTP effects pass adapter allowlists and mock/sandbox enforcement.
- [ ] Canonical event version, tenant ID, correlation/causation and idempotency key required.
- [ ] No secrets or real contact data in exports, tests, commits or examples.
- [ ] Twenty env names only as specified; no dead key variable.
- [ ] No Twenty REST `DELETE` anywhere, including tests/rollback helpers.
- [ ] Workflow writes require current policy and record revision; no blind stage overrides.
- [ ] Bounded retry/jitter, unknown-outcome reconciliation, dead-letter no-delete and alert owner.
- [ ] Provider signatures/replay defense verified before external ingress.
- [ ] Portal authorization tested server-side, including object/field/action scope.
- [ ] Global and tenant suppression checks use most restrictive signal.
- [ ] High-confidence fake fixtures test Florida/Oklahoma **owners**, without misusing homeowner address.
- [ ] AM-1 Roofing do-not-call represented only as a rule/fixture label, not real outreach data.
- [ ] No live/prohibited resource identifiers used by sandbox code.

### 14.2 Cross-system end-to-end scenarios

1. A new fake lead enters while Nurture is queued: Alex acquires lease and Nurture defers.
2. During Alex call, fake quote closes won: subsequent quote follow-up cancels; future customer journeys await completion.
3. A fake customer receives neutral review request regardless of favorable/unfavorable synthetic survey; service-recovery treatment remains separate.
4. Same customer otherwise eligible receives referral request independent of review sentiment; an explicit unresolved-service rule behaves uniformly and auditably.
5. Fake referee self-submits while an existing lead is active: coordinator retains source and does not create duplicate competing journeys.
6. Two fake channels reschedule simultaneously: only one calendar revision prevails; second revalidates.
7. `STOP` arrives while every channel has a queued item: suppression event is processed, each pre-send check denies; audit shows correct reason.
8. Human takeover arrives during sleeping n8n workflows: every next step sees human lease and exits/defers.
9. Provider duplicates/out-of-order receipts: no repeat sends, stage regression or duplicate charge/usage entries.
10. Portal is offline: inbound calls and suppression still process; projections retry independently.
11. Twenty is temporarily unavailable: no unrecorded external send; queue safely retries and respects expiry/current state.
12. Two fake tenants use identical external IDs/phone fixtures: records, commands, calendars and usage remain isolated.

### 14.3 Business ownership and exit

- Clients can receive an export of their leads, call logs and customer records under contract/process; test export format and access.
- Kynetic-built automations/agents remain Kynetic IP. Client ad accounts remain in the client’s name.
- Kynetic-owned Twilio numbers are ported on cancellation according to contractual terms; exact operational port workflow/vendor requirements need verification.
- No undocumented lock-in through portal-only business facts: operational records live in Twenty and export paths are documented.
- System deactivation must preserve suppression/audit/export requirements; never “clean up” with Twenty delete.

### 14.4 Final handoff package Claude should eventually produce

```text
docs/
  build-inventory.md             # evidence-backed current state
  architecture-decisions.md      # proposed/accepted/rejected decisions
  field-authority-matrix.md
  security-consent-runbook.md
  systems/<system>.md            # detailed spec per system
  testing/acceptance-report.md
templates/
  shared/                        # redacted exports and schemas
  systems/<system>/              # workflows/config/tests/docs
portal/                          # actual existing repo location determines paths
  contracts/                     # API schemas / mocked consumers
fixtures/
  fake-tenant-a/ fake-tenant-b/
```

The tree is a proposed logical layout, not a command to overwrite existing repository organization. Include exact test commands discovered from the actual repo, test report, dependency/license review, chaos/conflict results, deployment/rollback runbook and explicit list of anything not built.

## 15. Decisions and ambiguities for discovery (non-blocking defaults)

| Question | Proposed default for implementation docs | Critical before |
|---|---|---|
| Original maintenance meaning | customer service/warranty reminders; internal maintenance separate | client template approval |
| Emily existing behavior | inbound receptionist, but legacy behavior unknown; only net-new sandbox design | any production migration |
| First niche | remodelers first; warranty check-in optional | enabling maintenance/referrals |
| Voice recording | disabled until jurisdiction/policy/counsel review | voice sandbox/production policy |
| Transactional vs promotional messaging | restrictive, tenant/counsel-reviewed classification and evidence | every channel activation |
| Default calendar | fake adapter; then client existing provider | real booking tests |
| Review/referral post-service policy | uniformly defined completion/service criteria; never sentiment/review-gated | workflow acceptance |
| Multi-location | single tenant/location MVP, explicit hierarchy later | multi-location offers |
| Client Salesforce/HubSpot | compatibility contracts only; no install/connect; Twenty Kynetic ops record | client integration scope |
| Lock store | use strongest verified atomic mechanism; PostgreSQL only if required | concurrency tests |
| Portal stack/RBAC | preserve actual app stack after read-only inventory; role defaults above | UI implementation |
| Fair-use/caps | configurable and margin-validated; no fixed commercial assumption | pricing/billing offering |
| Full transformation | individually scoped workstreams and on-site plan, not unlimited package | SOW |
| Standard vs bespoke portal | shared base integration included as separate technical workstream; bespoke separately scoped | commercial scope |
| Vendor current terms | reverify at implementation/selection | procurement/production |

This document is ready for Claude to refine with evidence. It is not proof that any system, endpoint, integration or portal feature currently exists, and it grants no permission for production changes.

---

**End of handoff.**
