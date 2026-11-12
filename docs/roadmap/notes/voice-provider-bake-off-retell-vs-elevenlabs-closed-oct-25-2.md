# VOICE PROVIDER BAKE-OFF: Retell vs ElevenLabs (CLOSED Oct 25, 2026: ElevenLabs wins, D-025)

_Twenty note `aca91c0f`, created 2026-10-16, updated 2026-10-25. Exported 2026-11-12._

**CLOSED Oct 25, 2026. Verdict (Abdullah, Oct 22): ElevenLabs wins; v1 strict `agent_8201m5afn2rbeb7v29xfkhh1pjef` is Alex. See D-025 (replaces D-018 for Alex's voice platform) and task 3.9 (DONE).** Evidence for the verdict: v1 booked cleanly Oct 21 (conv_7001m5dzwydyeqabsy0zeepnm1rc, test event 7520336, 0 stacked questions in 19 turns, median delay 0.14 s). Not run: scorecard, v2 re-run, edge scripts 3/4/6; v2 never booked cleanly. The live prompt no longer promises a text (edited Oct 22) until Twilio A2P approves; restore is pre-approved. Free tier, demos only until the first client signs. Go-live plan: repo `docs/plans/ALEX-ELEVENLABS-GOLIVE.md`. The notes below are the history up to Oct 20 and are kept as is.

---

**(Oct 20 status, historical) Testing, no formal decision yet. Abdullah's read (Oct 19): ElevenLabs is ahead of Retell and a little cheaper.** Full write-up in the repo: `providers/BAKEOFF_SUMMARY.md` on branch `claude/provider-test-elevenlabs` (abdullah-kynetic/kynetic-ai, unmerged).

## What this is
Comparing voice AI platforms for Alex, the outbound speed-to-lead agent for the Kynetic Roofing demo (calls a lead right after a web form, qualifies, books a free roof inspection on Cal.com). It is Retell vs ElevenLabs only. Bland was started (branch claude/provider-test-bland) but never produced results and is dropped.

Rules: no changes to production Alex (agent_71e3cfc8384aa38a910a506b53), Nora, Emily, the Kynetic Restoration (Demo) build or Cal.com event 7404470. Same persona and 13-point scorecard on both. Only a winner gets wired into n8n. Decision rule: must beat Retell Alex Lab on one-question-per-turn, waits for answer, accuracy, false success and booking success without losing more than 25 percent on cost or delay; a tie keeps Retell.

## Where everything is (repo, branch claude/provider-test-elevenlabs)
- providers/BAKEOFF_SUMMARY.md: everything in one place
- providers/TEST_PLAN.md: rules, persona, scorecard, decision rule
- providers/elevenlabs/HANDOFF.md: state and next steps; RESULTS.md: runs and all change logs
- providers/elevenlabs/PROMPT.md (strict v1), PROMPT_V2.md (loose v2), TEST_SCRIPTS.md (all 9 scripts), PRICING.md, BUILD_MAP.md (n8n), snapshots/
- docs/progress.md (Oct 19 entry), docs/known-issues.md (KI-006), docs/decisions.md (D-018)

## The two builds
- Control: Retell Alex Lab agent_423ae0cb2803cba2891b376d44 (gpt-4.1, voice 11labs-Cimo). Measured about 14.5 cents/min all-in on its first live test; that call stacked questions, had two disagreeing email spellings and said "you're all set" while the booking had failed.
- Challenger: ElevenLabs Agents on the second account (abdullahblitz24; env key ELEVENLABS_API_KEY_blitz). `Alex | 11Labs | v1 strict prompt` (agent_8201m5afn2rbeb7v29xfkhh1pjef) and `Alex | 11Labs | v2 loose prompt` (agent_9701m5afn5rxehardsqttkq3pbjh). LLM deepseek-v41-flash temp 0, voice 1SM7GgM6IMuvQlz2BwM3, 25 s silence end-call, voicemail detection (hang up), end call on, language detection off. Cal.com via ElevenLabs' native integration (calcom_get_available_slots, calcom_create_booking) on test event 7520336 (phone required, email optional, fixed location; address goes in booking notes).
- n8n: the 35-node `11Labs | Outbound Speed to Lead` (xlmyRd5jBBBu8LX7) was on the cloud n8n; it is NOT on the VPS n8n (checked Oct 22). The VPS has only the Retell copy tXJwNTkNgKGnp0Ab.

## Strategies tested
1. Fixed the baseline agent (a leftover workflow node had injected a wrong persona in the first call; excluded).
2. Strict vs loose prompt A/B (v1 numbered steps + example; v2 goal-based, same hard rules).
3. Text confirmation instead of email (spoken email fails on d/e, v/t letter confusion on every provider); asks for a number when blank, digit-by-digit readback.
4. One combined confirmation of the form details instead of one question each.
5. Offer the two earliest slots; five business days, widen to ten.
6. Full address required (street, city, zip), ask once for what is missing.
7. Background-noise rule ("Sorry, I didn't catch that", once, then "somewhere quieter?").
8. Booking-failure handling: retry once, one honest line, accept "ASAP" as a callback time, never ask for a more specific time more than once.
9. Cal.com tools: custom webhook tools first, then the native integration. Native slots come back in UTC, so prompts convert to Pacific.
10. Dropped: n8n Agents (an agent can't replace the workflow), Bland.

## Results (Script 1 on each prompt, Oct 19, blitz account)
- v1 strict (conv_1501m5akjyheenssnw1d1zs4rb6g): 0 stacked-question turns of 16, waited every time, disclosure right after name check, one combined confirmation, no false "all set", delay median 0.66 s / worst 1.38 s. Booking failed (3x HTTP 400). Looped asking for a specific callback time after "ASAP".
- v2 loose (conv_4501m5aks4weebg8hxb6wc9x7gvw): 0 of 14, same good behavior, delay median 0.71 s / worst 23.2 s (tool retries). Booking failed (3x HTTP 400). Offered later slots first, said "booking that now" without waiting for a yes, dropped the offer question, double goodbye.
- Root cause of both failures was the tool setup, not the platform (address as location; phone sent as the literal {{lead_phone}}). Fixed; v1 then booked cleanly on Oct 21.
- Cost: ElevenLabs list price $0.08/min vs Retell $0.07-$0.31 (14.5 cents measured); ElevenLabs about 9-11 cents all-in vs Retell about 11-15. Real billing not captured. Free tier = 15 minutes.

## Open items after the verdict
1. Text confirmation: restore wording and add the SMS tool after Twilio A2P approval (KI-003, task 1.3); pre-approved.
2. Paid plan, phone import and the VPS n8n workflow when the first client signs (see the go-live plan).
3. Scorecard and cost per minute from real billing are still not captured.
