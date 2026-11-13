# BUILD PLAN 12: Online presence

_Twenty note `3857356f`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# BUILD PLAN: Online presence
*Pointer: main note "SYSTEMS INDEX". Service family: Acquisition & Visibility. n8n folder: Kynetic AI / Acquisition & Visibility. Updated 2026-11-09. Source: GitHub spec section 8.12 (abdullah-kynetic/kynetic-ai, branch claude/project-thread-kj2v2h, docs/systems/presence.md).*

**For the building LLM (reads only Twenty and n8n):** this note is a complete build plan. Everything here is a PROPOSAL until verified against current vendor docs, Twenty metadata and n8n node behavior. Build only net-new workflows, INACTIVE, tagged DEV, with no real credentials/sends; follow "N8N ORGANIZATION GUIDE" for folders and names. Hard limits: never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo); no Twenty REST DELETE; no activation, real outreach, calls or secrets; env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY; no Google Drive/Docs/Sheets. Reuse the built shared sandbox workflow "DEV - sys-sandbox-dispatch" (n8n id MOqT97N0ItVyKIno: policy decide + sink send) for all policy/dry-run logic.

## 0. Where we are today (read-only inventory 2026-11-09)
- **PARTIAL**: Portal presence items (profile, review_site, directory, social_post; status planned..needs_attention) and review snapshots, with integration tests. Task-list style, no canonical-fact/discrepancy model.
- **EXISTING**: Marketing site is live on www.kyneticai.com via Cloudflare Pages `kyneticai-preview`. DNS changes need approval.
- **MISSING**: Canonical business facts, profile inventory, discrepancy detection, change-approval queue, UTM capture convention.

## 1. Build plan
**Outcome:** maintain accurate public profiles/listings and useful local presence with approved changes; report visibility/actions without promising rankings. Not unlimited SEO, website design or review manipulation.

**MVP:** baseline business/profile inventory -> canonical facts -> discrepancy report -> client approval queue -> manual/API-supported update tasks -> verification and UTM capture. Unsupported scraping/posting prohibited. Preview-only websites; DNS always separate yes.

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

## 2. n8n placement and naming
- Folder: **Kynetic AI / Acquisition & Visibility**. Sandbox copies during build: **Kynetic AI / Sandbox (DEV)** named "DEV - presence | <function>" and tagged DEV. Promote (move + rename, drop DEV) only after an explicit activation approval from Abdullah.
- Workflow names: `presence-baseline`, `presence-monitor`, `presence-change-request`, `presence-verify`, `presence-report`. Display name rule: "Online presence | <function>".
- Every workflow: INACTIVE, error workflow set (see guide), executions without data saved, policy via the shared policy node, sends only through the sink adapter until approved.

## 3. Requirements and tests (traceability)
- **R-PRS-01** Hours change creates a proposal only; approval gates enforced. Workflow: `presence-change-request`. Fields: Canonical fact version (new). Test: T-PRS-01.
- **R-PRS-02** Unsupported scraping/posting prohibited; missing API -> manual task. Workflow: `presence-monitor`. Test: T-PRS-02.
- **R-PRS-03** Location A facts cannot affect B. Workflow: all. Fields: location_id, tenant_id. Test: T-PRS-03.
- **R-PRS-04** UTM capture deterministic; DNS/site production op impossible in sandbox. Workflow: `presence-verify`. Test: T-PRS-04, T-PRS-05.

## 4. Open gaps and unknowns
- Provider/vendor API capabilities unverified (Google Business Profile etc.).

## Built so far (2026-11-09)

Built 2026-11-09 by Scout (batch B). First niche: all types of remodelers. Every workflow below is a template: INACTIVE, tagged TEMPLATE, no credentials, folder Kynetic AI / Templates / Remodeling (1gC3UvDdVMyZFrTX). Status of every workflow: locally tested, unproven in n8n (the saved node code was run in a local harness on fake data: 555-010x numbers, invalid.example emails; no n8n test run is possible right now). Live copies: none.

Chain: Record Approved Business Facts -> Compare Listings to Approved Facts -> Propose Listing Changes for Approval -> (client approves) -> Verify Listing Changes and Tracking Links -> Monthly Visibility Report. Not yet linked by Execute Workflow.

- Template - Remodeling - Online Presence - Record Approved Business Facts | n8n id R91VXD8ymdYBQWso | plan workflow presence-baseline | sends nothing | local tests 3/3 passed: approved facts -> baselined with version; not approved -> pending; missing hours -> incomplete. Unproven in n8n.
- Template - Remodeling - Online Presence - Compare Listings to Approved Facts | n8n id lnL8y75eSPXDTF9I | plan workflow presence-monitor | sends nothing | local tests 4/4 passed: T-PRS-02 no supported API -> manual task; scraped snapshot refused; manual snapshot with different hours -> discrepancy; T-PRS-03 location B snapshot cannot affect A. Unproven in n8n.
- Template - Remodeling - Online Presence - Propose Listing Changes for Approval | n8n id Hwj4AMeETeCaxXRX | plan workflow presence-change-request | sends nothing | local tests 3/3 passed: T-PRS-01 hours change -> proposal only; approval for another location -> review; DNS change always needs separate yes. Unproven in n8n.
- Template - Remodeling - Online Presence - Verify Listing Changes and Tracking Links | n8n id i1ct7AkDikyRCy30 | plan workflow presence-verify | sends nothing | local tests 3/3 passed: T-PRS-05 DNS change impossible in sandbox; verified with before/after evidence + deterministic UTM; still differs -> not verified. Unproven in n8n.
- Template - Remodeling - Online Presence - Monthly Visibility Report | n8n id hQfFqptOdAZ7GTf2 | plan workflow presence-report | sends nothing | local tests 1/1 passed: report keeps unknown as unknown. Unproven in n8n.
- No scraping and no publishing: snapshots come only from manual entry (or a supported provider API once one is verified); a scraped snapshot is refused. No provider API is verified, so every profile without a snapshot becomes a manual check task.
- OPEN: needs Abdullah - provider API capabilities (Google Business Profile and others) and the approved adapter for applying changes (not built; approved changes become manual update tasks).
- OPEN: needs Abdullah - canonical fact store and change-approval queue (D-S04: no new Twenty objects without an approved metadata delta). Nothing is written.
- OPEN: needs Abdullah - how the monthly report is delivered (nothing is sent). DNS and website changes always need a separate yes; the verify step refuses DNS changes, site publishing and production deploys.
- OPEN: needs Abdullah - where per-client (tenant) settings live and who edits them (default: hardcoded template config labeled tenant_config: OPEN: needs Abdullah).
- OPEN: needs Abdullah - wire Template - Remodeling - Shared - Error Alert (gTV1LEsH51TaytUx) in as the error workflow for these templates (proposal only, not done).
- OPEN: needs Abdullah - signed webhook verification is not built; any input that arrives by webhook goes to human_review (reason webhook_signature_check_not_built).
- OPEN: D-S06 - where duplicate checks, leases and tokens are stored durably (default: input only, nothing stored).
- 2026-11-10 merge (Scout, approved by Abdullah): this system is now ONE workflow, Template - Remodeling - Online Presence (6Q5vxrKWmntLz1w6), inactive, TEMPLATE, 0 credentials, in Templates / Remodeling. Sections (call it with template_section = the section name; manual test run picks a section by number): 0. Record Approved Business Facts; 1. Compare Listings to Approved Facts; 2. Propose Listing Changes for Approval; 3. Verify Listing Changes and Tracking Links; 4. Monthly Visibility Report. Every check, Prepare data step and contact-lookup merge step is kept unchanged; hand-offs inside the system are now direct links into the next section, and sends go through Template - Remodeling - Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI). The 5 old separate workflows (R91VXD8ymdYBQWso, lnL8y75eSPXDTF9I, Hwj4AMeETeCaxXRX, i1ct7AkDikyRCy30, hQfFqptOdAZ7GTf2) were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Tests on the code fetched back from n8n (local emulator, NOT an n8n run): lookup and new-flag tests 264/264, link tests 59/59, chains 18/18 without errors or external effects (17 with identical step results, 1 with the same results moved to the save section), router and manual-run checks 106/107 (the 1 is an older problem, see merge results), round 2 unit outputs identical. Status: locally tested, unproven in n8n.
