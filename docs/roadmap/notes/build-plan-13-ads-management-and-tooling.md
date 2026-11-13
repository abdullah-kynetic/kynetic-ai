# BUILD PLAN 13: Ads management and tooling

_Twenty note `6dc0249c`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Ads management and tooling
*Pointer: main note "SYSTEMS INDEX". Service family: Acquisition & Visibility. n8n folder: Kynetic AI / Acquisition & Visibility. Updated 2026-11-09. Source: GitHub spec section 8.13 (abdullah-kynetic/kynetic-ai, branch claude/project-thread-kj2v2h, docs/systems/ads.md).*

**For the building LLM (reads only Twenty and n8n):** this note is a complete build plan. Everything here is a PROPOSAL until verified against current vendor docs, Twenty metadata and n8n node behavior. Build only net-new workflows, INACTIVE, tagged DEV, with no real credentials/sends; follow "N8N ORGANIZATION GUIDE" for folders and names. Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, real outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse the built shared sandbox workflow "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno: policy decide + sink send) for all policy/dry-run logic.

## 0. Where we are today (read-only inventory 2026-11-09)
- **PARTIAL**: Lead-sourcing from Meta Ad Library only (repo tools lead_engine.py, lead_census.py). This is prospecting, not client-ad reporting.
- **MISSING**: No ad-platform read connector, normalization, anomaly or attribution workflow. No client ad account access recorded.
- **EXISTING**: Twenty `opportunities.leadSource`, `endCustomers.leadSource`, `companies.metaAdsActive/liveAds/newAds30d` as lead-source fields.

## 1. Build plan
**Outcome:** reconcile ad delivery/spend to lead quality and business outcomes, detect anomalies and propose controlled actions. Client media spend is separate. The tool is not an autonomous unlimited-budget optimizer.

**MVP:** read-only sandbox connector -> normalized reporting -> UTM/lead reconciliation -> anomaly/recommendation queue. No auto budget/publish/pause. Actual ad writes are a later separately approved scoped capability.

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

## 2. n8n placement and naming
- Folder: **Kynetic AI / Acquisition & Visibility**. Sandbox copies during build: **Kynetic AI / Sandbox (DEV)** named "DEV - ads | <function>" and tagged DEV. Promote (move + rename, drop DEV) only after an explicit activation approval from Abdullah.
- Workflow names: `ads-auth-health`, `ads-read-connector`, `ads-normalize`, `ads-anomaly`, `ads-approval`, `ads-verify`, `ads-attribution`. Display name rule: "Ads management and tooling | <function>".
- Every workflow: INACTIVE, error workflow set (see guide), executions without data saved, policy via the shared policy node, sends only through the sink adapter until approved.

## 3. Requirements and tests (traceability)
- **R-ADS-01** Read-only credential cannot mutate; UI-injected action denied. Workflow: `ads-read-connector`. Test: T-ADS-01.
- **R-ADS-02** Duplicate daily metrics not summed; timezone/currency mismatch quarantines. Workflow: `ads-normalize`. Fields: observed metric/date range/currency. Test: T-ADS-02, T-ADS-03.
- **R-ADS-03** Unknown outcomes stay unknown, not zero; media spend separate from usage credits. Workflow: `ads-attribution`. Test: T-ADS-04, T-ADS-05.
- **R-ADS-04** Proposed change cannot run in MVP. Workflow: `ads-approval`. Test: T-ADS-06.

## 4. Open gaps and unknowns
- Client ad account access and API tier unknown.

## Built so far (2026-11-09)

Built 2026-11-09 by Scout (batch B). First niche: all types of remodelers. Every workflow below is a template: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). Status of every workflow: locally tested, unproven in n8n (the saved node code was run in a local harness on fake data: 555-010x numbers, invalid.example emails; no n8n test run is possible right now). Live copies: none.

Chain: Check Ad Account Access -> Read Ad Results (Read-Only Placeholder) -> Clean Up and Match Ad Numbers -> Spot Unusual Ad Results -> Ad Change Approval (No Changes in First Version) -> Confirm Ad Changes; Match Ad Leads to Results runs per reporting period. Not yet linked by Execute Workflow. Ad spend is kept separate from Kynetic usage credits.

- Template - Remodeling - Ads Management - Check Ad Account Access | n8n id IPdbzGQI0k17p0Tf | plan workflow ads-auth-health | sends nothing | local tests 4/4 passed: read-only access healthy; revoked -> high alert; write scope -> review; expiring in 3 days -> warn. Unproven in n8n.
- Template - Remodeling - Ads Management - Read Ad Results (Read-Only Placeholder) | n8n id PKdaT12WRJ1Fy22h | plan workflow ads-read-connector | sends nothing | local tests 3/3 passed: T-ADS-01 pause request from portal denied; no rows -> unknown, not zero; fake rows read as placeholder. Unproven in n8n.
- Template - Remodeling - Ads Management - Clean Up and Match Ad Numbers | n8n id iMgsThOWStMkOLie | plan workflow ads-normalize | sends nothing | local tests 3/3 passed: T-ADS-02 duplicate day not summed; latest kept; T-ADS-03 currency/timezone mismatch quarantined; unknown leads stay unknown. Unproven in n8n.
- Template - Remodeling - Ads Management - Spot Unusual Ad Results | n8n id 4LUAzea9pWpn6Svb | plan workflow ads-anomaly | sends nothing | local tests 2/2 passed: spike and spend without leads -> recommendation only; stale data flagged. Unproven in n8n.
- Template - Remodeling - Ads Management - Ad Change Approval (No Changes in First Version) | n8n id 7DYx2g6tCBCWEDxz | plan workflow ads-approval | sends nothing | local tests 2/2 passed: T-ADS-06 approved change still cannot run; UI action without approval denied. Unproven in n8n.
- Template - Remodeling - Ads Management - Confirm Ad Changes | n8n id qvTwONl03n2ugGeu | plan workflow ads-verify | sends nothing | local tests 2/2 passed: nothing executed -> nothing to verify; unexpected receipt -> review. Unproven in n8n.
- Template - Remodeling - Ads Management - Match Ad Leads to Results | n8n id ihwQIvcRXiOLnoRJ | plan workflow ads-attribution | sends nothing | local tests 1/1 passed: T-ADS-04/05 unknown revenue stays unknown; spend separate from usage. Unproven in n8n.
- No call is made to Meta or Google Ads: the read connector is a placeholder (connector: OPEN) that only reads fake rows given as input. Any change request (pause, budget, publish), including one from the portal, is denied; approved proposals still cannot run in the first version (executed: false).
- OPEN: needs Abdullah - client ad account access, API tier, read-only credential setup and the real read connectors (Meta, Google Ads).
- OPEN: needs Abdullah - anomaly thresholds (defaults: data older than 36 hours, spend over 1.5x trailing average, spend of 100+ with zero leads), attribution windows and which UTM mediums count as paid.
- OPEN: needs Abdullah - ad write capability (budget/action allowlist and separate approval) is a later scope; not built.
- OPEN: needs Abdullah - where per-client (tenant) settings live and who edits them (default: hardcoded template config labeled tenant_config: OPEN: needs Abdullah).
- OPEN: needs Abdullah - wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow for these templates (proposal only, not done).
- OPEN: needs Abdullah - signed webhook verification is not built; any input that arrives by webhook goes to human_review (reason webhook_signature_check_not_built).
- OPEN: D-S06 - where duplicate checks, leases and tokens are stored durably (default: input only, nothing stored).
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Ads Management (ZwPzaiL5KIEouxdY), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Check Ad Account Access; 1. Read Ad Results (Read-Only Placeholder); 2. Clean Up and Match Ad Numbers; 3. Spot Unusual Ad Results; 4. Ad Change Approval (No Changes in First Version); 5. Confirm Ad Changes; 6. Match Ad Leads to Results. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 7 old separate workflows (IPdbzGQI0k17p0Tf, PKdaT12WRJ1Fy22h, iMgsThOWStMkOLie, 4LUAzea9pWpn6Svb, 7DYx2g6tCBCWEDxz, qvTwONl03n2ugGeu, ihwQIvcRXiOLnoRJ) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
