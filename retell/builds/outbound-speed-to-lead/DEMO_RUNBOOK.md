# Demo runbook: Alex live test (written Oct 15, 2026)

Execution guide for the session that runs the live test. Every fact below was read from the live systems on Oct 15.

## Goal

One working end-to-end demo with Abdullah's own phone:
form submit → Alex calls within about 60 seconds → call 1 not answered → retry about 90 seconds later → call 2 answered → inspection booked on Cal.com → Twenty shows the lead as BOOKED with two interactions and secondsToFirstRing set.

## How Abdullah wants to be talked to

- No plans or status narration. Message him only for a result or a blocker.
- Ask for exactly one thing per message. Never send a list of asks.
- He has approved the demo path: the webhook fix, Alex's webhook URL, switching the workflow on for the test, and the test calls themselves.
- **Not approved:** publishing Alex, changing any Retell tool, touching Nora, Emily or Kynetic Restoration (Demo), and REST DELETE anywhere.

## Already done and verified (Oct 15)

| Item | State |
|---|---|
| n8n `m2YJwZ1l8DTzyEkw` | 38 nodes, inactive. Rollback version: `0ac046d1-3afd-486a-be54-83e4efa91be8`. New version: `0cfc27f6-3427-42c6-b3a4-982967fc856c`. |
| Post-call path | Retell Post Call Webhook (IP filter removed) → Is Analyzed Event? (`body.event == call_analyzed` and a call_id is present) → Fetch Call From Retell (GET `/v2/get-call/{id}`, credential `mxr1KufaMuc7ve4o`) → Normalize Call Result (reads the fetched call) → Final Analyzed Event? (requires a leadId and agentId = Alex). |
| Forgery test | Execution 2113: a fake call_id got a 404 at Fetch and nothing was written. A 404 rather than a 401 also confirms the credential authenticates. |
| Alex | `agent_71e3cfc8384aa38a910a506b53`, LLM `llm_5cbc32e5872bbd9afb452c692071`, unpublished, version 0. `webhook_url` = `https://abdullah-kyneticai.app.n8n.cloud/webhook/outbound-speed-to-lead-postcall-7f3a9c21d84e` (set and read back). Tools: check_availability_cal and book_appointment_cal (event 7404470, America/Los_Angeles), end_call. Voicemail: hang up. |
| Number +16692660586 | Custom SIP trunk to Twilio (`kynetic-retell-d1c9d9.pstn.umatilla.twilio.com`). Alex is attached as the outbound agent. No inbound agent, so callbacks to this number reach nothing. |
| Retell concurrency | Limit 20, currently 0. Alex had 0 calls before the test. |
| Cal.com 7404470 | "Roof Inspection", 30 min, at the attendee's address. Cal.com's API blocks python urllib (Cloudflare error 1010), so use `curl -A "Mozilla/5.0"` with `cal-api-version: 2024-06-14`. |
| Twenty | Every enum value the workflow writes exists. 0 endCustomers are in NEW, CALLING or NO_ANSWER, or have nextAttemptAt set, so the sweeper won't dial anyone on activation. Client account `56b85831-d0fd-4f0a-a9b7-e96956278bb8` = Kynetic Roofing (Demo). |
| Retry logic | Correct as built. Attempt 1 no-answer → Wait 90s → retry (attempt 2). Attempt 2 no-answer → +60 min via the sweeper (attempt 3). The +10 min nextAttemptAt is only a fallback if the 90s path fails. Do not "fix" it. |

## Run sequence

1. **Get the test number from Abdullah.** It is the one open ask. Refuse (541) 388-3621 (the AM-1 office) and Nora's line. ZIP: use his real ZIP, or 97702 if he doesn't give one. The calling window is 8:00 to 21:00 local to that ZIP, so check the current time there before activating.
2. **Re-check the sweeper.** Twenty must still have 0 endCustomers in NEW, CALLING or NO_ANSWER, or with nextAttemptAt set. If any exist, stop and report one line.
3. **Activate:** `publish_workflow m2YJwZ1l8DTzyEkw`. Then read `get_workflow_details` and confirm `active: true`. The production form URL is `https://abdullah-kyneticai.app.n8n.cloud/form/d7432694-dff4-4dda-a070-647dd4c9d606`. Confirm the path from triggerInfo after activation.
4. **Send Abdullah one message:** the form link, plus the instruction to submit his number and let the FIRST call ring out or decline it, then answer the SECOND call (about 90 seconds later) and book a time. Because of the 24-hour duplicate gate, a second form submit from the same phone is logged as DISQUALIFIED and never dialed. The whole test therefore runs on one submission.
5. **Watch.** Use `search_workflow_executions` and `get_workflow_execution` (includeData, truncateData 1), plus Retell `/v2/list-calls` filtered to Alex. Expected executions:
   - form path (Create Lead → Place Retell Call → Mark Lead Calling)
   - post-call for call 1 (no_answer or voicemail → Wait 90s)
   - the resumed retry (Place Retry Call → Mark Lead Retrying)
   - post-call for call 2 (booked)
   - Is Analyzed Event? stops call_started and call_ended events. That is expected.
6. **Verify, then report one line of results:**
   - **Twenty endCustomer:** leadStatus BOOKED, attemptCount 2, secondsToFirstRing set (target ≤ 60), lastOutcome BOOKED.
   - **customerInteractions:** two records, NO_ANSWER or VOICEMAIL, then BOOKED with bookedSlot.
   - **Cal.com:** a booking exists on 7404470 (curl `GET /v2/bookings`).
7. **Deactivate:** `unpublish_workflow`. Then ask the one question: leave it on for the demo? On a yes, re-publish.
8. **Wrap up:** update the docs (`progress.md`, `decisions.md` with D-002 amended (front desk = get the owner's number or book a callback), D-012 retries now 3 (90s / +60 min), and new D-019 (1,200 min, $0.25 overage, 60s guarantee, human request → callback booked, Kynetic owns client Twilio numbers); `known-issues.md` KI-005 (the IP filter was replaced by fetching each call back from Retell); and `KYNETIC_CONTEXT.md` (Alex IDs, 38 nodes, webhook set)). Update the Twenty note "Alex Build Status" (`3b42aa79-7c56-40a7-b546-6b864f6f32e5`) with the test result. Commit on branch `claude/alex-demo-live-test` and push. No PR unless asked.

## If something fails (diagnose, fix if it's in scope, else ask one thing)

| Symptom | Cause | Action |
|---|---|---|
| Place Retell Call error mentions publish or version | Retell won't dial an unpublished agent with `"latest"` | Ask Abdullah one question: OK to publish Alex? |
| Error mentions verification, KYC or identity | Outbound KYC isn't done | Ask him to finish Retell identity verification. |
| Call placed but disconnection_reason is `dial_failed`, `invalid_destination` or a SIP error | Twilio trunk termination or auth | Read the Retell call record. Report one line. |
| Check Recent Duplicate or Find Leads Due for Retry errors | Twenty REST filter syntax | Fix the filter string in that node. This is in scope. Run once more. |
| Post-call never arrives | Webhook not reaching n8n | Check the Retell call's `webhook_url`, and confirm the workflow is active. The test URL won't receive production calls. |
| Call 1 answered by mistake | Fast retry won't fire | If booked, verify that path and report. The 90s retry stays untested, so say that explicitly. |
| A Gmail alert fires | Call placement failed | Read the error in the execution, not the email. |

## Out of scope for the demo

Per-client config, the `[CLIENT]` template, the Add-a-Client guide, minute tracking and alerts, the full time-zone table, the go-live checklist, self-hosted Twenty cutover, and the DNC/human-callback outcomes. These wait for client #1.
