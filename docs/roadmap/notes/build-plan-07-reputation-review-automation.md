# BUILD PLAN 07: Reputation / review automation

_Twenty note `d787e4b1`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Reputation / review automation
*Pointer: main note "SYSTEMS INDEX". Service family: Customer Growth. n8n folder: Kynetic AI / Customer Growth. Updated 2026-11-09. Source: GitHub spec section 8.7 (docs/systems/review.md on branch claude/project-thread-kj2v2h). LATER backlog.*

**For the building LLM (reads only Twenty and n8n):** complete build plan, all PROPOSAL until verified. Build only net-new workflows, INACTIVE, tagged DEV, no real credentials/sends; follow "N8N ORGANIZATION GUIDE". Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno).

## 0. Where we are today (read-only inventory 2026-11-09)
- **EXISTING**: Legacy review/response/referral chain (archive, inactive, 15 nodes; n8n Cloud id 477BKA79couMRF51).
- **PARTIAL**: Client portal has a `reviewSnapshots` table (review count snapshots) with tests.
- **MISSING**: Review request job (decided 2026-10-31: 2 hours after payment received; email until A2P). Completion trigger, eligibility, neutral template, reconcile.
- **EXISTING**: Twenty `clientJobs.status` and `invoices.paidAt/status` as candidate completion/payment evidence.

## 1. Build plan
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

## 2. n8n placement and naming
- Folder: **Kynetic AI / Customer Growth**. Sandbox copies during build: **Kynetic AI / Sandbox (DEV)** named "DEV - review | <function>", tagged DEV. Promote only after an explicit activation approval from Abdullah.
- Workflows: review-completion, -eligibility, -request, -feedback, -reconcile. Display name rule: "Review | <function>".
- Every workflow: INACTIVE, error workflow set, executions without data saved, policy via the shared policy node, sends only through the sink adapter until approved.

## 3. Requirements and tests (traceability)
- **R-REV-01** Request sent to all operationally eligible customers regardless of sentiment. Workflow: review-eligibility. Fields: clientJobs.status. Test: T-REV-01.
- **R-REV-02** No gating, no incentive, no private-feedback diversion. Workflow: review-request. Test: T-REV-02 static check of branches.
- **R-REV-03** Missing profile link holds request; never invent URL. Workflow: review-request. Fields: tenant_config.review_profile_urls. Test: T-REV-03.
- **R-REV-04** Duplicate completion -> one request; cancelled/reopened job excluded. Workflow: review-completion. Fields: clientJobs. Test: T-REV-04.
- **R-REV-05** Click without observable review not counted as a posted review. Workflow: review-reconcile. Fields: reviewSnapshots. Test: T-REV-05.
- **R-REV-06** Coverage-by-segment audit proves no sentiment selection. Workflow: review-reconcile. Test: T-REV-06.

## 4. Open gaps and unknowns
- Counsel/platform terms review for anti-gating (task 1.4 adjacent).

## Built so far (2026-11-09)

First niche: all types of remodelers (bath, kitchen, basement, deck, any remodeler). These workflows are the Remodeling templates for that niche.

Built 2026-11-09 (batch A, built and checked by Scout). All workflows below are templates: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). Names follow the full-name rule (Template - Remodeling - Review Requests - ...). Every send goes through Template - Remodeling - Shared - Message Safety Check and Send (MOqT97N0ItVyKIno); nothing is sent for real.

- Template - Remodeling - Review Requests - Confirm Job Is Finished | n8n id 0ksPmQx4p4bBmR43 | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. review-completion (R-REV-04): job COMPLETED plus invoice PAID with paid_at -> verified, request time 2 hours after payment; cancelled or reopened excluded; duplicate completion ignored (per execution; durable store OPEN D-S06). Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_rev.json; no n8n test run because the editor needs sign-in).
- Template - Remodeling - Review Requests - Check Who Can Be Asked | n8n id FqnAmSIErjGmWvgw | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. review-eligibility (R-REV-01): rating/sentiment fields removed before any rule (T-REV-01: 5-star and 1-star customers get the same decision); strict boolean dnc/smsOptOut/callOptOut/emailOptOut (null or missing -> human_review); excluded for suppression, DNC, email opt-out, already asked for this job, 90-day customer cooldown (OPEN). Channel email until A2P. Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_rev.json; no n8n test run because the editor needs sign-in).
- Template - Remodeling - Review Requests - Send Review Request | n8n id tW8k7FtESCbEqxtA | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. review-request (R-REV-02, R-REV-03): one neutral message for everyone, no incentive (incentive input -> human_review), no gating or private-feedback detour (static check passed); missing review profile link -> hold, never invented; reopened job -> hold; sends via MOqT, outcome shows policy_decision and policy_reason. Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_rev.json; no n8n test run because the editor needs sign-in).
- Template - Remodeling - Review Requests - Handle Customer Feedback | n8n id ru77jWgUjkKrmH2a | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. review-feedback: complaints or rating 3 or lower -> high-priority service recovery task; feedback never changes the review request (review_request_effect none); opt-out words suppress (same rule as Missed-Call Text-Back - Sort Replies); no automated replies. Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_rev.json; no n8n test run because the editor needs sign-in).
- Template - Remodeling - Review Requests - Check Review Results and Fairness | n8n id ZiGpwTy4qx0rLI5G | folder Kynetic AI / Templates / Remodeling | inactive, TEMPLATE, no credentials. review-reconcile (R-REV-05, R-REV-06): only observed review references count as reviews (clicks are not reviews); coverage by satisfaction segment; any gap or an eligible customer not asked without an operational reason -> human review (sentiment selection suspected). Status: locally tested, unproven in n8n (saved node code run in a local harness on fake data, see /workspace/kynetic/n8n/batchA/results_rev.json; no n8n test run because the editor needs sign-in).
- OPEN: needs Abdullah - review profile links per location (default: one fake link under invalid.example; others hold); neutral copy and sender identity (counsel/platform terms pending); cooldown and request cap (defaults 90 days, 1 per job); optional bounded reminder (not built); where email opt-outs live (D-S04, default: emailOptOut input flag, nothing written).
- OPEN: needs Abdullah - how templates become live copies; where per-client settings live (default: hardcoded config labeled tenant_config: OPEN: needs Abdullah); wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow (proposal only).
- 2026-11-09 contact lookup (Scout): Template - Remodeling - Review Requests - Check Who Can Be Asked (FqnAmSIErjGmWvgw); Template - Remodeling - Review Requests - Send Review Request (tW8k7FtESCbEqxtA) now call Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) with wait for completion on, right after 'When Executed by Another Workflow' (new nodes: Pick contact details for CRM lookup -> Look up contact and opt-out settings in CRM (shared, waits for result) -> Use CRM contact and opt-out settings; nothing else in the step changed, the Manual test path is unchanged). dnc, smsOptOut and callOptOut now come from the CRM record as stored; the most restrictive value wins and leadStatus DNC counts as dnc true. not_found, ambiguous_contact or a flag the CRM does not store -> null -> the step's own fail-closed check sends the item to human review. Locally tested, unproven in n8n (lookup tests 129/129 on code fetched back from n8n).
- Resolved 2026-11-09 (Abdullah approved adding what the templates need in Twenty): endCustomers now has doNotCall, emailOptOut, smsConsent, callConsent (BOOLEAN, unset = null), consentSource, ownerState (two-letter), timezone (IANA) (TEXT, unset = empty string). Consent capture time stays in the existing consentAt field. Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) reads doNotCall directly and also returns emailOptOut, owner_state, timezone and consent_channels (from smsConsent/callConsent).
- Resolved 2026-11-09 (evening, second pass): endCustomers now also has emailConsent (BOOLEAN, unset = null), and consent_channels includes 'email'. Every step's 'Use CRM contact and opt-out settings' node now also copies owner_state, timezone, consent_channels and emailOptOut from the CRM. The CRM is the source: a value it does not store becomes null; owner_state or timezone that differ between the item and the CRM become null (kept as crm_conflicts so a later step does not refill them); consent channels are limited to those both allow; an email opt-out from either side wins. Local tests: a missing CRM timezone, quiet hours from the CRM timezone and no consent channel each block the send in all 15 sending steps.
- OPEN: needs Abdullah - (1) a Twenty credential for the disabled Twenty nodes and the tenant -> clientAccount map; (2) the new fields are empty on all existing records (no backfill), so in live mode sends stay blocked until they are filled.
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Review Requests (UDtgnG06G7ldBrUp), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Confirm Job Is Finished; 1. Check Who Can Be Asked; 2. Send Review Request; 3. Handle Customer Feedback; 4. Check Review Results and Fairness. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 5 old separate workflows (0ksPmQx4p4bBmR43, FqnAmSIErjGmWvgw, tW8k7FtESCbEqxtA, ru77jWgUjkKrmH2a, ZiGpwTy4qx0rLI5G) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
