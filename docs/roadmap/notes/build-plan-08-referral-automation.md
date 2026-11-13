# BUILD PLAN 08: Referral automation

_Twenty note `d751793c`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Referral automation
*Pointer: main note "SYSTEMS INDEX". Service family: Customer Growth. n8n folder: Kynetic AI / Customer Growth. Updated 2026-11-09. Source: GitHub spec section 8.8 (docs/systems/referral.md on branch claude/project-thread-kj2v2h). LATER backlog.*

**For the building LLM (reads only Twenty and n8n):** complete build plan, all PROPOSAL until verified. Build only net-new workflows, INACTIVE, tagged DEV, no real credentials/sends; follow "N8N ORGANIZATION GUIDE". Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno).

## 0. Where we are today (read-only inventory 2026-11-09)
- **PARTIAL**: Referral step lives inside the legacy review chain (n8n Cloud id 477BKA79couMRF51, archive, inactive).
- **MISSING**: Share token, self-serve form, dedupe/attribution, reward review. Twenty has `leadSource` selects only; no referral object.

## 1. Build plan
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

## 2. n8n placement and naming
- Folder: **Kynetic AI / Customer Growth**. Sandbox copies: **Kynetic AI / Sandbox (DEV)** named "DEV - referral | <function>", tagged DEV. Promote only after an explicit activation approval from Abdullah.
- Workflows: referral-eligibility, -invite, -self-serve-intake, -dedupe, -attribution, -reward-review. Display name rule: "Referral | <function>".
- Every workflow: INACTIVE, error workflow set, executions without data saved, policy via the shared policy node, sends only through the sink adapter until approved.

## 3. Requirements and tests (traceability)
- **R-REF-01** Eligibility independent of review sentiment; any service-recovery hold applied uniformly. Workflow: referral-eligibility. Test: T-REF-01.
- **R-REF-02** Referee self-submits with consent; no outreach from third-party-uploaded contacts. Workflow: referral-self-serve-intake. Fields: Consent Grant. Test: T-REF-02.
- **R-REF-03** Tokens scoped, unguessable, tenant-bound. Workflow: referral-invite. Fields: Referral token (new). Test: T-REF-03 tamper/cross-tenant.
- **R-REF-04** Self/duplicate referrals and existing active leads go to review; original source preserved. Workflow: referral-dedupe. Fields: leadSource, source touches. Test: T-REF-04, T-REF-05.
- **R-REF-05** Reward cannot auto-settle. Workflow: referral-reward-review. Test: T-REF-06.

## 4. Open gaps and unknowns
- First niche remodelers: referral/maintenance enablement decision pending.

## Built so far (2026-11-09)

Built 2026-11-09 by Scout (batch B). First niche: all types of remodelers. Every workflow below is a template: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). Status of every workflow: locally tested, unproven in n8n (the saved node code was run in a local harness on fake data: 555-010x numbers, invalid.example emails; no n8n test run is possible right now). Live copies: none.

Chain (each step is its own workflow, not yet linked by Execute Workflow): Check Who Can Be Asked for Referrals -> Send Referral Invite -> Receive Referral Form Submissions -> Check for Duplicate and Self-Referrals -> (new lead goes to Speed-to-Lead intake) -> Credit the Referral Source -> Send Reward for Owner Review.

- Template - Remodeling - Referral Program - Check Who Can Be Asked for Referrals | n8n id nu6RL5HzyuVdnRPc | plan workflow referral-eligibility | sends nothing | local tests 9/9 passed: eligible after completed kitchen job; T-REF-01 negative-review customer same branch as positive; missing dnc flag -> human_review; job not completed; inside 7-day cool-off; invited 30 days ago -> cooldown; uniform service hold applies to unresolved issue; unresolved issue ignored when no uniform policy; webhook-shaped input never trusted. Unproven in n8n.
- Template - Remodeling - Referral Program - Send Referral Invite | n8n id J112VvkreSQW5qUH | plan workflow referral-invite | sends only through Template - Remodeling - Shared - Message Safety Check and Send (MOqT97N0ItVyKIno) | local tests 8/8 passed: eligible -> safety check allows test send; not eligible -> blocked before send; smsOptOut missing -> human_review; opted out -> policy suppress; FL owner -> policy suppress; email channel needs emailOptOut boolean; non-test number rejected by sink; two inputs -> two outputs. Unproven in n8n.
- Template - Remodeling - Referral Program - Receive Referral Form Submissions | n8n id wo3Xvxj7C5iapeyg | plan workflow referral-self-serve-intake | sends nothing | local tests 6/6 passed: T-REF-02 referee self-submits with consent; T-REF-02 third-party upload never contacted; no consent -> no contact; T-REF-03 token from another tenant; T-REF-03 tampered token; webhook input -> human_review (signature not built). Unproven in n8n.
- Template - Remodeling - Referral Program - Check for Duplicate and Self-Referrals | n8n id 3fUkBJeWblCyCADR | plan workflow referral-dedupe | sends nothing | local tests 5/5 passed: new person -> accepted new lead; T-REF-04 self-referral; T-REF-05 existing active lead keeps original source; duplicate submission; burst of 5 on one token -> fraud review. Unproven in n8n.
- Template - Remodeling - Referral Program - Credit the Referral Source | n8n id MS48l0DUypoE7RX0 | plan workflow referral-attribution | sends nothing | local tests 3/3 passed: won inside window -> attributed, reward review; unknown stage stays unknown; outside window. Unproven in n8n.
- Template - Remodeling - Referral Program - Send Reward for Owner Review | n8n id IJ7QbVkseY9MpIfM | plan workflow referral-reward-review | sends nothing | local tests 3/3 passed: won referral -> owner review task, not settled; T-REF-06 auto-settle refused; not won -> not applicable. Unproven in n8n.
- OPEN: needs Abdullah - referral share tokens are TEST-ONLY hashes (reftest_...); real tokens need signing with a server-side secret and a token store.
- OPEN: needs Abdullah - reward amount, caps, terms, owner and payment (separate approved financial integration; legal/tax reviewed outside engineering). Rewards never settle automatically.
- OPEN: needs Abdullah - whether a uniform service-recovery hold is used (default off). Review rating and sentiment are never read for eligibility.
- OPEN: needs Abdullah - referral landing page / form backend (the intake workflow has an inactive webhook; nothing listens).
- OPEN: needs Abdullah - where per-client (tenant) settings live and who edits them (default: hardcoded template config labeled tenant_config: OPEN: needs Abdullah).
- OPEN: needs Abdullah - wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow for these templates (proposal only, not done).
- OPEN: needs Abdullah - signed webhook verification is not built; any input that arrives by webhook goes to human_review (reason webhook_signature_check_not_built).
- OPEN: D-S06 - where duplicate checks, leases and tokens are stored durably (default: input only, nothing stored).
- 2026-11-09 contact lookup (Scout): Template - Remodeling - Referral Program - Check Who Can Be Asked for Referrals (nu6RL5HzyuVdnRPc); Template - Remodeling - Referral Program - Send Referral Invite (J112VvkreSQW5qUH) now call Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) with wait for completion on, right after 'When Executed by Another Workflow' (new nodes: Pick contact details for CRM lookup -> Look up contact and opt-out settings in CRM (shared, waits for result) -> Use CRM contact and opt-out settings; nothing else in the step changed, the Manual test path is unchanged). dnc, smsOptOut and callOptOut now come from the CRM record as stored; the most restrictive value wins and leadStatus DNC counts as dnc true. not_found, ambiguous_contact or a flag the CRM does not store -> null -> the step's own fail-closed check sends the item to human review. Locally tested, unproven in n8n (lookup tests 129/129 on code fetched back from n8n).
- 2026-11-09 (Scout): new Template - Remodeling - Referral Program - Look Up Existing People and Recent Referrals (mKKf72TrQG7klpbl), inactive, TEMPLATE, no credentials. Called with wait for completion on from Receive Referral Form Submissions, between its Prepare data for next step node and the hand-off to Check for Duplicate and Self-Referrals (link 13). It looks the referrer up in the CRM (through the shared contact lookup, by the token's customer id), reads endCustomers matching the referee (read-only, disabled Twenty node, OPEN: needs Twenty credential) and attaches referrer, existing_people and recent_submissions. Unknown referrer -> lookups left null -> human review (lookup_data_missing). Template mode uses fixed fake records. Locally tested, unproven in n8n.
- Resolved 2026-11-09: new Twenty object Referral Submission (referralSubmissions) with referrer (-> endCustomers), refereeName, refereePhone, refereeEmail, projectType, submittedAt, status (NEW, DUPLICATE, SELF_REFERRAL, ACCEPTED, WON, LOST, HUMAN_REVIEW; default NEW), clientAccount (-> clientAccounts), source and referralToken. Template - Remodeling - Referral Program - Look Up Existing People and Recent Referrals (mKKf72TrQG7klpbl) reads recent submissions from it in live mode (disabled read node, OPEN: needs Twenty credential). Check Who Can Be Asked for Referrals' Prepare data for next step node reads the merged customer.
- Resolved 2026-11-09: new Template - Remodeling - Referral Program - Save Referral Submission to CRM (RjioG20mEuqYUBcb), inactive, TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling. Receive Referral Form Submissions now waits for the duplicate check, then saves each submission with its status (ACCEPTED, DUPLICATE, SELF_REFERRAL, HUMAN_REVIEW; WON/LOST are set later). Its Twenty create node is disabled (OPEN: needs Twenty credential); in template mode the record goes to a test-only sink and nothing is written.
- Resolved 2026-11-09 (Abdullah approved adding what the templates need in Twenty): endCustomers now has doNotCall, emailOptOut, smsConsent, callConsent (BOOLEAN, unset = null), consentSource, ownerState (two-letter), timezone (IANA) (TEXT, unset = empty string). Consent capture time stays in the existing consentAt field. Template - Remodeling - Shared - Look Up Contact and Opt-Out Settings in CRM (otGXbuaTgvSL8h2h) reads doNotCall directly and also returns emailOptOut, owner_state, timezone and consent_channels (from smsConsent/callConsent).
- Resolved 2026-11-09 (evening, second pass): endCustomers now also has emailConsent (BOOLEAN, unset = null), and consent_channels includes 'email'. Every step's 'Use CRM contact and opt-out settings' node now also copies owner_state, timezone, consent_channels and emailOptOut from the CRM. The CRM is the source: a value it does not store becomes null; owner_state or timezone that differ between the item and the CRM become null (kept as crm_conflicts so a later step does not refill them); consent channels are limited to those both allow; an email opt-out from either side wins. Local tests: a missing CRM timezone, quiet hours from the CRM timezone and no consent channel each block the send in all 15 sending steps.
- OPEN: needs Abdullah - (1) a Twenty credential for the disabled Twenty nodes and the tenant -> clientAccount map; (2) the new fields are empty on all existing records (no backfill), so in live mode sends stay blocked until they are filled.
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Referral Program (R0TIDuxUTnvvDdux), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Check Who Can Be Asked for Referrals; 1. Send Referral Invite; 2. Receive Referral Form Submissions; 3. Check for Duplicate and Self-Referrals; 4. Save Referral Submission to CRM; 5. Credit the Referral Source; 6. Send Reward for Owner Review. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 7 old separate workflows (nu6RL5HzyuVdnRPc, J112VvkreSQW5qUH, wo3Xvxj7C5iapeyg, 3fUkBJeWblCyCADR, RjioG20mEuqYUBcb, MS48l0DUypoE7RX0, IJ7QbVkseY9MpIfM) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
- 2026-11-10 (Scout): Look Up Existing People and Recent Referrals stays a separate shared workflow, renamed Template - Remodeling - Shared - Look Up Existing People and Recent Referrals (mKKf72TrQG7klpbl). The one wait-for-result hand-off inside this system (Receive Referral Form Submissions -> Check for Duplicate and Self-Referrals) is kept as a call to this same workflow with template_section set, so the save step only runs after a form submission; Save Referral Submission to CRM is now a direct link.
