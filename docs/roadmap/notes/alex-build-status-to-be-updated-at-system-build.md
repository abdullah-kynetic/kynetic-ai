# [ARCHIVED 2026-11-09, stale stub; see SCORECARD 5c44b12e] Alex Build Status (to be updated at system build)

_Twenty note `3b42aa79`, created 2026-10-14, updated 2026-11-09. Exported 2026-11-12._

# Alex (outbound speed-to-lead agent) — build status, Oct 13 2026

**To be updated at the system build.** Alex's prompt is written for roofing; other niches need a prompt update at onboarding.

Status: BUILT, NOT LIVE. No test calls have been made. Nothing goes live without Abdullah's personal check.

## What exists
- Retell agent "Alex" in the abdullahblitz workspace (unpublished). Books on Cal.com, ends the call on voicemail.
- Twilio number +1 669-266-0586 assigned to Alex (approved; not Nora's line).
- n8n workflow "Outbound Speed to Lead" saved but switched OFF (37 nodes).

## How it works when turned on
- Starts when any lead form sends a submission (Meta lead form, Google, or website form via webhook, email, or Zapier).
- Calls only 8 AM to 9 PM in the lead's local time (ZIP first, then area code, then Pacific as a fallback). No special Florida/Oklahoma call-time rule (Abdullah declined it).
- Up to 3 attempts: retry about 90 seconds later, final try 60 minutes later.
- Records seconds-to-first-ring in Twenty for speed-to-lead proof.
- SMS steps exist but stay disabled.

## Waiting on Abdullah's yes
1. His own review of the workflow in the n8n editor.
2. Connecting Retell's post-call results to n8n (webhook update).
3. A check that the post-call webhook's IP filter works behind n8n Cloud.
4. Any test call.
5. Publishing Alex.

## Known limits
- The ZIP and area-code time-zone tables are simplified, and the time-zone code is syntax-checked only.
- Twenty has an smsOptOut field but no SMS-consent field.

