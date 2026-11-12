# N8N ORGANIZATION GUIDE

_Twenty note `19cd5846`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# N8N ORGANIZATION GUIDE

*Pointer: main note "SYSTEMS INDEX". Updated 2026-11-09. Applies to every BUILD PLAN note. n8n instance: VPS self-hosted (https://n8n.kyneticai.com), personal project id 3wNlIXzev4BaDkGf.*

**For the building LLM (reads only Twenty and n8n):** follow this guide for every workflow you create. Everything stays INACTIVE until Abdullah gives an explicit activation approval. Every system has two kinds of workflow: a **template** (always off, test data only) and a **live copy** made from the approved template.

## 1. Folder tree (ids for reference, updated 2026-11-09 cleanup)

```text
Kynetic AI (3nxcYooivbdfqjJu)
  Templates (ysndFrr5Fs52O4jY)                 -> one sub-folder per niche; templates only, always OFF
    Remodeling (1gC3UvDdVMyZFrTX)              -> first niche (remodeling in general: bath, kitchen and more): one workflow per sellable system + shared tools
  Revenue Response (MGIDtKzylUsDE5r9)        -> LIVE copies: 01 Speed-to-Lead (Alex), 02 Emily, 03 Missed-Call Text-Back
  Pipeline Conversion (CfNxxDTbykKkOtrB)     -> LIVE copies: 04 Quote Follow-Up, 05 Reactivation
  Customer Growth (Xvz3Oz7cWonify8a)         -> LIVE copies: 06 Nurture, 07 Reputation/review, 08 Referral, 09 Maintenance/service reminders
  Revenue Infrastructure (SxjbLEfiPycnwT2k)  -> LIVE copies: 10 CRM, 11 Scheduling
  Acquisition & Visibility (NheZ27jiMA5Bb5vl)-> LIVE copies: 12 Online presence, 13 Ads
  Platform Ops (eDVNrmGL6zV9mohc)            -> LIVE copies: 14 Platform, error alerts, health, backup/credential checks
  Shared tools (vBGGQjcFrDM2esjQ)            -> LIVE shared helpers used by every niche (message safety check and send, opt-out list) + generic helpers (Kynetic CRM Email, Attachment Text Extractor, Zip Attachments)
  Sandbox (DEV) (8LNP5veFSbVZCJ2c)           -> experiments and throwaway tests only (DEV - error-alert, DEV - ElevenLabs Speed to Lead)
  Receptionists (f2wLNyAKuLDahioI)           -> Nora/Emily live: DO NOT TOUCH
  Outbound Speed to Lead (LIuHzTXqsWVB3jcI)  -> legacy Retell/11Labs Alex drafts: read only
Archive (aIUXCSErGj5RupQU, root)             -> retired workflows (moved here, never deleted)
  Seekers Youth (6pIQ9VdUbA8JgQAA)           -> old client, retired; copy in GitHub kynetic-ai PR #145
  Porchlight Card (jKI7Lw62lFCsAhZI)         -> old client, retired; copy in GitHub kynetic-ai PR #145
  Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs) -> the 79 old one-job Remodeling templates, replaced by the merged system workflows (names unchanged)
```

Do not create other folders without need. A new niche gets its own folder under **Kynetic AI / Templates / <Niche>** only where its logic really differs; if only wording, prompts or settings change, reuse the same templates and live set with niche/tenant config.

## 2. Where workflows go (template -> live)

1. **Template first.** New work and every change is built and tested in the template in **Kynetic AI / Templates / <Niche>** (first niche: Remodeling). Templates are always OFF, have no real credentials, and are tested with fake/pinned data only.
2. **Naming, in full plain words, no abbreviations (no DEV, TPL, textback, etc.).** One workflow per system (since 2026-11-10): `Template - <Niche> - <Full System Name>`, for example `Template - Remodeling - Missed-Call Text-Back`. Inside it, each job is a section (sticky note titled with the job, for example Send Text) that starts with a node named Start: <Job>. Shared tools stay separate: `Template - <Niche> - Shared - <What It Does>`, for example Template - Remodeling - Shared - Message Safety Check and Send (Callable). System names (14 system workflows in Templates / Remodeling, always written in full): Speed-to-Lead, Missed-Call Text-Back, Quote Follow-Up, CRM, Scheduling, Review Requests, Old-Lead Reactivation, Maintenance and Service Reminders, Referral Program, Long-Term Nurture, Inbound Receptionist, Online Presence, Ads Management, Platform Health Checks. The Front Door Webhook and the Back-End Manager Agent are shared tools (Shared - ...).
3. **Tag:** `TEMPLATE` on every template. (`DEV` is only for throwaway experiments in Sandbox (DEV).)
4. **Live copy** (only after Abdullah explicitly approves that system): duplicate the approved template into the system's family folder (Revenue Response etc.; shared tools into Shared tools). The copy gets a new n8n ID, so re-point every Execute Workflow / sub-workflow link to the live IDs (keep an old-ID -> new-ID map). Live name = the template name without `Template - <Niche> - `, for example `Missed-Call Text-Back - Send Text`. Attach real credentials and activate only with Abdullah's yes. The template stays in place.
5. **Changes:** edit and test the template -> Abdullah approves -> copy the change to the live copy. Never edit live directly.
6. **Archive** means moving the workflow into the root **Archive** folder (client folders go inside it). Never delete, and never use n8n's archive endpoint (POST /workflows/{id}/archive is a soft delete).

## 3. Mandatory properties of every workflow

- INACTIVE; do not call publish/activate.
- Templates: tag `TEMPLATE`; no real credentials attached (reference credentials by name only, never paste secrets); no live HTTP calls to vendors. Use the sink adapter for sends.
- Error workflow set to the shared `platform-error-alert` once it exists; executions: do not save data on success.
- Policy decisions go through the shared policy node. Call "Template - Remodeling - Shared - Message Safety Check and Send (Callable)" (id YOEnu9pkfg4TEZBI, made 2026-11-10): When Executed by Another Workflow or Manual trigger -> Policy decide -> Sink send, code copied unchanged from MOqT97N0ItVyKIno (the original, formerly DEV - sys-sandbox-dispatch, only has a Manual trigger, so it cannot be called; it is left untouched for Abdullah to decide on, and its proposed diff is not applied). Policy rule order: invalid input, tenant inactive, channel disabled, production not approved, suppression, DNC, opt-out, owner-state gate (FL/OK by owner state only), unknown owner, human-owned, no consent, lease held elsewhere, unknown timezone, quiet hours 8-21 contact time, else allow. Sink rejects non-test recipients (+1555010xxxx, @invalid.example) and requires an idempotency key.
- Test with pinned data only (test_workflow / prepare pin data), never with real contacts.
- Idempotency key on every side effect: tenant + system + source id + step.

## 4. Twenty rules

- Env names only: TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY (TWENTY_API_KEY is dead). Never print or store key values.
- No REST DELETE of any record; to remove, set status or archive/soft-delete fields instead.
- API pacing: 100 requests per 60 seconds; batch with create_many/upsert_many, add waits.
- Twenty is the system of record for Kynetic's operational facts. If n8n or the portal disagrees with Twenty, flag with both values; do not pick one.
- Do not create new Twenty objects/fields without an approved metadata delta; logical entities (Consent Grant, Suppression, Lease, Appointment, Audit Log) stay as schema until approved.

## 5. DO NOT TOUCH

- Nora (agent + workflow), live Emily (agent + workflow), live Alex agent `agent_8201m5afn2rbeb7v29xfkhh1pjef`, Kynetic Restoration (Demo) records.
- Any ACTIVE workflow: do not edit, move or deactivate. Do not send real SMS/calls/emails.
- Folder Receptionists and everything inside Archive (incl. Archive / Seekers Youth and Archive / Porchlight Card: other clients / retired).
- No Google Drive/Docs/Sheets for Kynetic.

## 6. Existing n8n estate (after cleanup, 2026-11-09)

- Tags: `TEMPLATE` (templates) and `DEV` (old drafts/experiments). Data table `6mNIcmYYqhvcsm7j` website_contact_submissions (contact form flow `WxIh0Hw4lQodY1Xa` is ACTIVE, owned by the site: do not touch).
- Moved to Archive on 2026-11-09: `VFLHx1Ko0OYP2J4j` (Vapi), `WeLvpCW3G9VEmhIC` (VAPI copy), `3RdmNRxd17POGzlB` (Cal.com booking SMS), `KkSZ22d2BvV3EOos` (TEMPLATE — Client Config Lookup, Notion-based), `iUUaUDtG6fLKNn6w` (Research Agent), `ha9RH9aj6AfN8BEv` (DEMO HVAC Riley), `EZlvEqhYTk2ZOQl9` (Great Clips), `uRE15TjHUG2iq3kW` (Pap Products), old drafts `cYHVXD1blenqvalE` (owner-alert), `mMBRyfd3NiWLLLQI` (reminder), `p9gPYyRPtd00Wt0h` (missed-call), `wWsM69Xx1B8Mfy9s` (Setup Safety Check). Sandbox (DEV) now holds only `ijQVSulzSU5HeQp5` (error-alert, start point for platform-error-alert) and `hwjiTYVg91i5vIFS` (DEV - ElevenLabs Speed to Lead).
- Legacy Alex drafts in Outbound Speed to Lead: `tXJwNTkNgKGnp0Ab` (Retell), `xlmyRd5jBBBu8LX7` (11Labs), `fJjshZWiUN0xPcCE` (Retell test), all inactive.
- Remodeling templates (updated 2026-11-10 merge): 22 workflows in Templates / Remodeling, all INACTIVE, tagged TEMPLATE, 0 credentials. 14 system workflows, one per system: Speed-to-Lead 4nWBO2PS62LjAXVm (7 sections); Missed-Call Text-Back kNpAzQXEY1SB3Xhj (4 sections); Quote Follow-Up 0WY9ZFBHxwitw28L (6 sections); CRM hU0LVdY7VrahZvFJ (6 sections); Scheduling DfRXMSufrfFMOF5K (6 sections); Review Requests UDtgnG06G7ldBrUp (5 sections); Old-Lead Reactivation euQLC5pScUGAGLcj (6 sections); Maintenance and Service Reminders Jq4qrLPd4NCoitDl (5 sections); Referral Program R0TIDuxUTnvvDdux (7 sections); Long-Term Nurture jESzAz80ZHeErvSr (6 sections); Inbound Receptionist oJKV3Q9gxPmKV4j4 (5 sections); Online Presence 6Q5vxrKWmntLz1w6 (5 sections); Ads Management ZwPzaiL5KIEouxdY (7 sections); Platform Health Checks hQI9WmIdHytWBQOr (4 sections). Shared tools: Message Safety Check and Send (Callable) YOEnu9pkfg4TEZBI; Look Up Contact and Opt-Out Settings in CRM otGXbuaTgvSL8h2h; Look Up Existing People and Recent Referrals mKKf72TrQG7klpbl; Front Door Webhook (Receive and Label Every Event) xhPM1aUfsdXqi9hN; Back-End Manager Agent EZgdJlOAcTufAtsG; Record Opt-Outs on Do-Not-Contact List nYy2G48xRai2anwX; Error Alert gTV1LEsH51TaytUx; plus the original Message Safety Check and Send MOqT97N0ItVyKIno (not callable, left for Abdullah). The 79 old one-job workflows were moved, names unchanged, to Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10) (9MQXGyT3aybA7kZs). Full list with ids and sections: /workspace/kynetic/n8n/template-index-2026-11-10.md on the box; details: /workspace/kynetic/n8n/merge-results-2026-11-10.md. No live copies exist yet.

## 6b. How the systems connect (2026-11-09)

- One front door: Shared - Front Door Webhook (Receive and Label Every Event) (xhPM1aUfsdXqi9hN) receives every event, labels it and runs ONE fixed route: the merged system workflow by ID plus template_section = the section (new lead -> Speed-to-Lead / Lead Intake and Duplicate Check; missed call -> Missed-Call Text-Back / Sort Missed-Call Events; quote issued/changed -> Quote Follow-Up; booking or calendar change -> Scheduling; record conflict -> CRM / Resolve Conflicting Updates; voice events -> Speed-to-Lead voice sections; job completed and feedback -> Review Requests; reactivation replies -> Old-Lead Reactivation; service completed and reminder replies -> Maintenance and Service Reminders; exact opt-out keywords -> Missed-Call Text-Back / Sort Replies and Hand Off to Team, fixed rule). Messy events go to Shared - Back-End Manager Agent (EZgdJlOAcTufAtsG); anything unsure becomes a task for a person.
- The Back-End Manager only proposes. Its tools are read-only sections of the merged workflows, called with a fixed template_section (Scheduling / Find Open Times, Scheduling / Understand Booking Request, Quote Follow-Up / Sort Replies, CRM / Resolve Conflicting Updates); fixed rules run before and after it.
- Inside a system workflow, a section hands off to the next one with a direct link from its 'Prepare data for next step' node to the next section's 'Start: <Job>' node (no Execute Workflow call). Other workflows call a system workflow through its one 'When Executed by Another Workflow' trigger with template_section = the section name; the picker 'Which section? (template_section)' sends the item to that section's Start node, and an unknown or missing name goes to a person. The Manual trigger runs one section's built-in fake data (set the number in 'Manual test run: pick a section'). The only call left inside a system is Referral Program's wait-for-result duplicate check, which calls the same workflow.
- Systems never call each other directly. Cross-system hand-offs go only through the Front Door and Back-End Manager routes; next steps that code names in another system (Speed-to-Lead intake, Shared - Record Opt-Outs, Scheduling) stay proposals in the output.
- Steps separated by a wait, a customer choice, a client approval, or a condition are NOT linked (for example Find Open Times -> Book Appointment, Build Approved Campaign Group -> Send Campaign Messages). Every send goes through Shared - Message Safety Check and Send (Callable) (YOEnu9pkfg4TEZBI).
- Status: locally tested, unproven in n8n (the editor needs Abdullah's sign-in for a real run). All 18 hand-offs that needed data now have a Prepare data step (the referral one is fixed in template mode only; live mode still needs the Twenty credential), and 18 sending steps look contacts up in Twenty first. Error Alert is not wired as an error workflow (proposal only).

## 7. Build order

Phase 0 foundation (done: policy + sink). Then per STATUS priority: Alex text-first Pack A, the ONE unified CRM deliverable, scheduling, essential follow-up (missed-call text-back, quote follow-up). Other systems are a later backlog. Within each system, build workflows in the order listed in its plan, validate (validate_workflow), pin-data test, tag, folder, then report the n8n ids back in the system's Twenty note (append a line "Built: <name> <id>").

## 8. Reporting

When you finish a workflow add to the system's BUILD PLAN note a "Built so far" list with n8n id, folder, DEV status and the tests that ran. Anything unknown goes under "Open gaps"; do not guess IDs or prices (pricing authority: D-023 and KYNETIC_CONTEXT).
