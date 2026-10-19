# ElevenLabs results

Persona and scorecard: `providers/TEST_PLAN.md`. Control: Retell Alex Lab.

## Verification of unverified PROMPT.md items
Status 2026-10-16: docs sites (elevenlabs.io) are still blocked from the cloud session (proxy 403), so nothing is confirmed from docs. `api.elevenlabs.io` and `api.cal.com` work. Cal.com slots confirmed live; the rest settles on test calls.
| Item | Status | How to settle |
|---|---|---|
| One-second pause tag (`<break time="1.0s" />`) | Unverified | Put the tag in a test readback; listen for a real pause. Keep " ... " if not honored by the chosen voice model. |
| Current-time variable name (`{{system__time}}`) | Unverified | Open the agent's dynamic variables list in the dashboard and copy the exact system variable name. |
| Cal.com v2 request shapes (slots, bookings, `cal-api-version` header, body fields) | Slots VERIFIED: GET /v2/slots?eventTypeId=7404470&start&end&timeZone with `cal-api-version: 2024-09-04` returns 200 and slots (Mon-Fri, 9:30-16:00 PT seen). Bookings UNVERIFIED (not called, would make a real booking); `/v2/event-types/7404470` returned 404 with 2024-09-04. | Test each server tool in the dashboard against event type 7404470; record the working headers and body here. |

## Agent change log (agent_9301m52zy185e609f8vyws4r1r7q "Roofing Assistant", only agent in account)
2026-10-16, via API. Cause of run 0: the agent had a workflow with an `override_agent` node whose additional prompt said "Bend Roofing Solutions" with fillers, on top of the builder default prompt.
1. Replaced system prompt with the PROMPT.md block (verified byte-identical on read-back).
2. First message set to `Hi, is this {{first_name}}?` (was a long opener with "um").
3. Dynamic variable defaults set (first_name, company_name, agent_name, service_type, owns_property, issue_type, timeline, email blank). TTS speed 1.0.
4. Workflow reset to the start node only (removed the two override_agent nodes and edge).
5. Voicemail detection added with empty message (hang up, no message).
6. Post-call data fields replaced with outcome, callback_time, booked_slot, notes (old lead_name, inspection_booked, etc. removed).
7. Created workspace secret `cal_api_key` (Cal.com key as Bearer; not in config or repo). Created webhook tools check_availability (`tool_6901m533bpdsfxbrcnkf4yc981qs`, GET /v2/slots, 2024-09-04) and book_appointment (`tool_5801m533bqkpejm85hkxnfv66eve`, POST /v2/bookings, 2024-08-13; address sent in bookingFieldsResponses.notes; a browser User-Agent is set). Attached both to the agent. end_call was already on.
Left as found: LLM `deepseek-v41-flash` temp 0, voice 1SM7GgM6IMuvQlz2BwM3, model eleven_v3_conversational, language_detection tool on, turn_v3. Record these in the cost write-up; consider testing a stronger LLM if conversation quality is weak.

## Cal.com change log
2026-10-17, via API (v2, `cal-api-version: 2024-06-14`). Original event type 7404470 untouched (Retell and Bland still use it).
- Created event type **7520336** "Roof Inspection (ElevenLabs test)", slug `roof-inspection-elevenlabs-test`, https://cal.com/abdullah-kyneticai/roof-inspection-elevenlabs-test. Same settings as 7404470 (30 min, attendeeAddress location, 120 min notice, default schedule) except booking questions: phone (`attendeePhoneNumber`) required, email optional.
- Verified: slots for 2026-10-19 and 2026-10-20 match the original (9 and 7). A real booking is not yet tested.
- Not yet done: ElevenLabs tools still point at 7404470 and send an email. Next: repoint them to 7520336, send `attendee.phoneNumber`, update the prompt for text confirmation.

## Agent change log: v2 variant
2026-10-19, with Abdullah's OK (second agent, for A/B only).
- Created **Alex v2 (loose prompt)**, `agent_8001m5abyte4frzadt0y52dpvswk`, from the 2026-10-17 snapshot of the v1 agent with only the system prompt replaced by `PROMPT_V2.md` (goal-based stages plus hard rules, no step script or example call, adds a "when you can't make it out" rule for background noise). Same voice, LLM, tools, variables, voicemail, data fields and event type 7404470 (email confirmation) as v1, so only the prompt differs.
- v1 (`agent_9301m52zy185e609f8vyws4r1r7q`) is unchanged and has no noise rule yet. Not yet tested on a call.
- Noise settings (turn eagerness, interruptions) left at defaults on both agents; see chat notes for options.

## Account move: building and testing now on the blitz account
2026-10-19. Keys live in the environment as `ELEVENLABS_API_KEY_blitz` (new account, abdullahblitz24) and `ELEVENLABS_API_KEY_kyneticai` (old account). Plain `ELEVENLABS_API_KEY` no longer exists, so use the suffixed names. Both accounts are on the Free tier (10,000 credits).
Rebuilt on blitz from the 2026-10-17 snapshots, same config as before:
- Voice: "Mark - Casual, Relaxed and Light" (`1SM7GgM6IMuvQlz2BwM3`) added from the shared library; premade voices were all that existed there.
- Secret `cal_api_key` (`F8s22QdPcB0qJP9MsR55`); tools check_availability `tool_3501m5afmd47fjw842ya61z5kyzq` and book_appointment `tool_2501m5afmdgef4gacn3qsgnxagrs` (still event type 7404470, email-based).
- **Alex | 11Labs | v1 strict prompt** `agent_8201m5afn2rbeb7v29xfkhh1pjef` and **Alex | 11Labs | v2 loose prompt** `agent_9701m5afn5rxehardsqttkq3pbjh`. Verified: tools attached, voicemail on, opener, workflow reset to start node.
- Old account agents (`agent_9301m52zy185e609f8vyws4r1r7q` v1, `agent_8001m5abyte4frzadt0y52dpvswk` v2) are left in place and no longer the working copies.

## Change log: text confirmation + hardening (2026-10-19, blitz agents only)
Applied to both Alex | 11Labs | v1 strict prompt and v2 loose prompt, plus the two Cal.com tools:
- Cal.com tools now use test event **7520336** (phone required, email optional). `book_appointment` sends `attendee.name`, `attendee.phoneNumber`, `attendee.timeZone` (no email) and the slot `start` exactly as returned (no UTC conversion). Both unverified until a real booking: whether v2 bookings accept `phoneNumber`, a missing email, and an offset timestamp.
- Prompts: email step and email readback removed; confirmation is by text to the number being called (`{{lead_phone}}`; asks once if empty on a dashboard test). Closing line: "You'll get a text with the details." Readback section kept for phone numbers/letters.
- Availability search window: next five business days, widen to ten.
- Silence: call ends after 25 s of silence (`silence_end_call_timeout`, was never).
- Removed the `language_detection` system tool. Dynamic variable `email` replaced with `lead_phone`.
- **Not done: sending the text.** There is no text tool and no Twilio. Alex says a text is coming, which is false in a test until that tool exists; fine for the test persona only. Twilio trial limited to Abdullah's and Quentin's numbers is the planned way to test it.
- Old account agents and the old event 7404470 are untouched.
- Follow-up (same day): added the "different number" path. If the lead declines the dialed number, Alex asks for another, reads it back digit by digit, and the booking tool uses that one instead of `lead_phone`. Both prompts and the `phoneNumber` tool description updated.

- Follow-up (2026-10-19): combined the form-detail confirmation. Both prompts now confirm issue, ownership and timeline in ONE question ("I see you asked about a roof inspection for a leak, you own the property, and you'd like it looked at this week. Did I get that right?") instead of one question per detail; blank or corrected values are asked individually. v1 Steps 3 and 4 rewritten and the example call updated; v2 bullet rewritten. Applied to both blitz agents.

## Fixes after runs 1 and 2 (2026-10-19)
- `book_appointment` now sends `location: {type: attendeeAddress, address}` (required by event 7520336); `bookingFieldsResponses.notes` removed; phoneNumber description forbids passing a placeholder. Verified the new body shape against Cal.com with a past start time (no booking made): passes validation, fails only on "meeting in the past".
- Prompts v1 and v2: offer the two earliest slots; empty `lead_phone` means ask for the number (never "the number I'm calling"); retry a failed booking once, then a single honest "scheduling system isn't responding" line, accept "ASAP" as a callback time, ask for specificity at most once; v2 confirms day/time/address as a question and waits for a yes before booking; address passed exactly as spoken.

## Runs
| Run | Date | Round (voice email / prefilled) | Stacked-question turns / total turns | Waited for answers? | Email exact? | Readback 1-5 | False "all set"? | Booked? | Delay median / worst | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 (invalid) | 2026-10-16 | voice, dashboard test | n/a | n/a | n/a | n/a | Yes (said booked, no tool exists) | No real booking | not captured | Not running PROMPT.md: wrong opener, invented company name ("Bend Roofing Solutions"), no name check, no AI/recording disclosure, no qualifying questions, stacked questions, invented slots, asked for phone number, no email step, fillers present. Excluded from totals. |
| 1 (v1 strict, blitz) | 2026-10-19 | dashboard, Script 1, text confirmation | 0 / 16 | Yes | n/a (text) | n/a | No (never said booked) | No: 3x HTTP 400 | median 0.66 s / worst 1.38 s | `conv_1501m5akjyheenssnw1d1zs4rb6g`. Cause: Cal.com event 7520336 needs `location` {type attendeeAddress, address}; tool did not send it. Also sent phoneNumber as literal `{{lead_phone}}` (blank on dashboard tests, Alex never asked for a number). Fallback asked for a specific callback time 3x after "ASAP". |
| 2 (v2 loose, blitz) | 2026-10-19 | dashboard, Script 1, text confirmation | 0 / 14 | Yes | n/a (text) | n/a | No | No: 3x HTTP 400 | median 0.71 s / worst 23.2 s (tool retries) | `conv_4501m5aks4weebg8hxb6wc9x7gvw`. Same Cal.com cause. Offered tomorrow's slots before today's earlier ones; said "One sec, booking that now" in the same turn as the confirmation without waiting for a yes; dropped the offer question; honest fallback ("team will follow up") but two goodbyes. |

## Edge cases
| Case | Pass/fail | Notes |
|---|---|---|
| "Is this a robot?" | | |
| Not interested | | |
| Wrong number, don't call again | | |
| Silence | | |
| Talking over the agent | | |
| Voicemail (hangs up, no message) | | |

## Totals (fill when the round ends)
- Stacked-question turns:
- Email exact matches:
- False successes:
- Booking success:
- Delay (median / worst):
- Billed cost per minute (all-in):
- n8n integration effort (hours, estimate):

## Verdict vs Retell Alex Lab

## Change log: native Cal.com integration (2026-10-19)
- Abdullah added a Cal.com API-key connection on blitz ("cal.com testing", `icxn_9201m5am6y02ehpvw4rndr4xzd6p`). It lives under `/v1/convai/api-integration-connections`, not tools or MCP.
- Native `calcom_create_booking` has no `location` field, so event 7520336 location changed from attendeeAddress to a fixed address ("At the property (address in booking notes)"). Validated against Cal.com with a past date (only "meeting in the past" error). The property address now goes in `bookingFieldsResponses.notes`. Event 7404470 untouched.
- Both blitz agents now use `calcom_get_available_slots` and `calcom_create_booking` (inline `api_integration_webhook` tools, eventTypeId and timeZone constants); the custom webhook tools were detached from both agents (still exist in the workspace).
- Native slots return UTC, so both prompts convert to Pacific before speaking (7h behind until Nov 1, then 8h). Prompts and tool names updated in PROMPT.md and PROMPT_V2.md.
- Not yet tested live.
