# D-025: ElevenLabs is the voice platform for Alex (v1 strict); text promise removed until Twilio A2P approves

_Twenty note `38f8496f`, created 2026-10-25, updated 2026-11-09. Exported 2026-11-12._

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

D-025 remains the provider decision (ElevenLabs for Alex). The original free-tier/demo and pending-SMS observations are dated evidence, not a current provider inspection. A2P registration and actual approved sending configuration must be evidenced separately; never infer working SMS from an old approval or completed registration task. Historical standing wording below is not permission under this cleanup to edit/publish live Alex or activate workflows. Current roadmap and scoped approvals govern future work.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

## D-025: ElevenLabs is the voice platform for Alex (v1 strict); text promise removed until Twilio A2P approves
**Status:** decided by Abdullah
**Date:** 2026-10-25 (verdict given 2026-10-22)

**Why:** The Retell vs ElevenLabs bake-off (task 3.9) is closed. Abdullah called the verdict: ElevenLabs wins, and the v1 strict prompt goes live ("v1 is perfect"). v1 is the only prompt with a clean booked call (Oct 21: 0 stacked questions in 19 turns, median response delay 0.14 s). The 13-point scorecard, the v2 re-run and edge scripts 3, 4 and 6 were not run; the verdict is Abdullah's call.

**Decided:**
1. Alex runs on ElevenLabs agent `agent_8201m5afn2rbeb7v29xfkhh1pjef` (v1 strict, blitz account abdullahblitz24). The v2 loose agent `agent_9701m5afn5rxehardsqttkq3pbjh` is not used.
2. Free tier, demos only until the first client signs. No paid plan, no phone import, no outbound dialing from ElevenLabs yet. Go-live plan: `docs/plans/ALEX-ELEVENLABS-GOLIVE.md` in the repo.
3. On 2026-10-22 the live v1 prompt was edited to stop promising a text, because no text can be sent until a Twilio A2P campaign is approved. It still collects the contact number and ends with "You're all set. Anything else?". Before/after prompts: `providers/elevenlabs/golive/` in the repo.
4. Standing approval (Abdullah, 2026-10-22): once the Twilio A2P campaign is approved, Claude restores the text wording itself and adds the SMS tool (`providers/elevenlabs/SMS_TOOL.md`), without asking again.
5. The Retell Alex build (agent_71e3cfc8384aa38a910a506b53, n8n tXJwNTkNgKGnp0Ab) is parked, not deleted, and was never activated.

**Replaces:** D-018 as far as it makes Retell the platform for Alex. Still stands from D-018: Vapi parked; Nora and Emily stay on Retell workspace kyneticai, frozen.

**Numbering flag:** Twenty has D-023 (offer and pricing). The repo branches feat/brand-revamp and fix/a2p-privacy-terms carry D-023 (site rebuild) and D-024 (offer). D-025 was the first number free in both places. Reconcile when those branches merge.

**Repo PR:** branch claude/project-thread-i6rpsu on abdullah-kynetic/kynetic-ai (not merged).
