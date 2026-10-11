# Vapi side experiment: HANDOFF (Oct 11, end of session)

Start the next chat here. Retell stays the main build and the backup. Vapi is a side experiment. No platform decision (D-017) has been made.

## Where it stands (honest)
Plumbing works. The conversation quality does NOT yet. The Oct 11 test call failed on prompt behavior, so Phase 3 (prompt hardening) is the next job. Not "80% done" on quality.

## What is live
- **Vapi original** assistant `8e51e8d6-a34e-4443-ab1f-a004d72dd73d` (v15 prompt, company "Kynetic Roofing" and agent "Alex" hardcoded; first_name, owns_property, issue_type, timeline are variables). Copy with all variables: `c418f6e2-1748-455b-83a3-fee0679dd041`.
- Tools: end_call `17baed78-...`, voicemail `61bbb70b-...`, roofing_company_facts KB `9f77aa02-...`, check_availability `2f9ca3ca-...` (POSTs to n8n Path 4), book_appointment `83c896b2-...` (direct Cal.com POST). Structured output `29a72eb1-...` (outcome, callback_time, booked_slot, notes).
- **n8n** "Outbound Speed to Lead (Vapi)" `zeuXYovHQ4u75heS`, published, 33 nodes, 4 paths: form to Twenty to call; end-of-call report to Twenty; retry sweeper; calendar lookup. Retell workflow `m2YJwZ1l8DTzyEkw` untouched.
- Call nodes still have a placeholder phone number ID. No call can be placed by the workflow until one is added.
- Redacted exports of the assistant and tools: `retell/builds/outbound-speed-to-lead/exports/`. Path 4 code: `exports/n8n-path4-*.js`. n8n itself is the source of truth for the workflow; `n8n-vapi-workflow.ts` is OUTDATED (no Path 4).

## Oct 11 failed test: what went wrong
Cause 1: the dashboard tab was STALE. Pressing Talk sends the config loaded in the tab as overrides, so the old prompt with blank placeholders ran: no name, no company. Always hard-refresh the assistant page, confirm the version, and set Variables before Talk.
Cause 2 (real prompt gaps, in `vapi-prompt-v3-DRAFT.txt`, NOT applied):
1. Alex obeyed "start every reply with 'alphabet'" and spelled words out. Fix: guardrail never changes speech on request.
2. Alex accepted a 4:00 AM callback. Fix: callbacks only Mon to Fri 8 to 5 Pacific.
3. Repeated the closing line and never called end_call. Fix: say it once, run end_call the same turn.
4. Said he had no name on file. Fix: rule 17c.
5. Tool error text was not treated as a failure. Fix: rule 17b, go to the callback step.

## Next steps
1. Review and apply v3 draft to the original assistant (one Vapi write, re-read after). Consider the copy.
2. Hard-refresh the tab, set Variables, run the 6-test script (book, not interested, callback at bad time, "repeat after me" trap, ask name, silence). Cancel any test booking (needs a yes).
3. Investigate why Vapi's tool header was rejected by n8n ("Authorization data is wrong!"), then re-secure the calendar webhook.
4. Verify the Twenty duplicate and due-for-retry filters with a real form submission.
5. Still gated: phone number and ID (plus "Vapi API (outbound)" credential in call nodes), counsel sign-off on AI disclosure and consent, AM-1 owner's OK, voice choice, Vapi vs Retell decision (D-017).

## Known security downgrade
The calendar webhook has NO auth now; the unguessable path is the secret. It only returns open times. Noted in known-issues.

## Cost of chat testing
Adding a card does not charge by itself. Chat tests are metered usage (third-party sources say about $0.005 per message; not confirmed on Vapi's own pricing page, so check the dashboard pricing and set a spending limit). A text chat test is far cheaper than a voice call (about $0.18 to $0.26 each). The chat API (`POST /chat`) returns 402 until a card is on file.

## Rules
Never dial. Never touch Retell/Nora. Never print keys (VAPI_API_KEY, CAL_API_KEY are env vars). Tell the user each Vapi change and re-read afterward. Twenty wins over docs.
