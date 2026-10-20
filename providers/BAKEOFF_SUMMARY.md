# Voice provider bake-off: full summary (as of 2026-10-20)

Single place to read everything. Written so a new project or a new Claude session can pick this up cold.

## What this is
Comparing voice AI platforms for **Alex**, the outbound speed-to-lead agent for the Kynetic Roofing demo (calls a lead right after a website form, qualifies, books a free roof inspection on Cal.com). **Retell vs ElevenLabs.** Bland was started (branch `claude/provider-test-bland`) but never produced results and is dropped. It is a bake-off, not a decision: Retell stays the platform (D-018) until a verdict is logged. Abdullah's read (2026-10-19): **ElevenLabs is ahead and a little cheaper.** The scorecard and billing still have to confirm it.

## Where everything is
| What | Where |
|---|---|
| Rules, persona, 13-point scorecard, decision rule | `providers/TEST_PLAN.md` |
| This summary | `providers/BAKEOFF_SUMMARY.md` |
| Current state and next steps | `providers/elevenlabs/HANDOFF.md` |
| Run-by-run results, every change log, scorecard totals | `providers/elevenlabs/RESULTS.md` |
| Strict prompt (v1), source of truth for `Alex | 11Labs | v1 strict prompt` | `providers/elevenlabs/PROMPT.md` |
| Loose prompt (v2) | `providers/elevenlabs/PROMPT_V2.md` |
| All 9 test scripts, exact wording | `providers/elevenlabs/TEST_SCRIPTS.md` |
| Pricing research | `providers/elevenlabs/PRICING.md` |
| n8n build proposal and status | `providers/elevenlabs/BUILD_MAP.md` |
| Config snapshots (agents, tools JSON) | `providers/elevenlabs/snapshots/2026-10-17` (old account), `snapshots/2026-10-19-blitz` |
| Repo branch | `claude/provider-test-elevenlabs` of `abdullah-kynetic/kynetic-ai` (unmerged; nothing on main) |
| Twenty | note "VOICE PROVIDER BAKE-OFF: Retell vs ElevenLabs" (id `aca91c0f-bd17-4b24-be0d-360cedce194b`), task 3.9 (`7c350f17-a000-452c-9f08-db215f54b706`) |
| Repo docs | `docs/progress.md` (2026-10-19 entry), `docs/known-issues.md` (KI-011, renumbered from KI-006 on 2026-10-20, and a gotcha), `docs/decisions.md` (D-018: Retell is the platform) |

## The two builds
- **Control: Retell Alex Lab** `agent_423ae0cb2803cba2891b376d44` (production Alex `agent_71e3cfc8384aa38a910a506b53` is never touched). LLM gpt-4.1, voice 11labs-Cimo (D-008, D-012). Measured about 14.5 cents a minute all-in (call `call_4bfbca5c12d7f5e7f1f2ba04a6a`, v1.0 prompt): stacked questions in the opener and readback, two email spellings disagreed, said "you're all set" while the booking had failed.
- **Challenger: ElevenLabs Agents**, on the second account (`abdullahblitz24`, env var `ELEVENLABS_API_KEY_blitz`; old account `ELEVENLABS_API_KEY_kyneticai` holds snapshots only). Two agents: `Alex | 11Labs | v1 strict prompt` `agent_8201m5afn2rbeb7v29xfkhh1pjef` and `Alex | 11Labs | v2 loose prompt` `agent_9701m5afn5rxehardsqttkq3pbjh`. LLM `deepseek-v41-flash` temp 0, voice `1SM7GgM6IMuvQlz2BwM3` ("Mark - Casual, Relaxed and Light"), TTS `eleven_v3_conversational`, 25 s silence end-call, voicemail detection (hang up, no message), end_call on, language detection removed. Cal.com via ElevenLabs' native integration ("cal.com testing" connection, tools `calcom_get_available_slots` and `calcom_create_booking`) on test event type **7520336**. Dynamic variables: first_name, company_name, agent_name, service_type, owns_property, issue_type, timeline, lead_phone (blank on dashboard tests).
- **Cal.com:** production event 7404470 ("Roof Inspection", used by Retell, email required) is untouched. Test copy 7520336 has phone required, email optional, and a fixed location ("At the property (address in booking notes)") because the native booking tool cannot send a location field.
- **n8n:** `11Labs | Outbound Speed to Lead` (`xlmyRd5jBBBu8LX7`, 35 nodes, inactive, never run) is a copy of the Retell workflow, now named `Retell | Outbound Speed to Lead` (`tXJwNTkNgKGnp0Ab`; the prod workflow `m2YJwZ1l8DTzyEkw` is separate and untouched). Still needs credentials (Twenty API, ElevenLabs `xi-api-key`, Gmail), agent ID and phone number ID placeholders, an imported Twilio number, and the post-call webhook URL. Wired only if ElevenLabs wins.

## Strategies tested (in order)
1. **Fix the baseline agent.** First ElevenLabs call (run 0) was invalid: a leftover workflow override node injected a wrong persona ("Bend Roofing Solutions", fillers). Removed it and loaded the real prompt.
2. **Strict vs loose prompt (A/B).** v1 is a numbered step script with hard rules and a worked example. v2 is goal-based: stages as guidance, same hard rules, no example. Question: does less structure sound more human without losing the rules?
3. **Text confirmation instead of email.** Leads are on cell phones; spoken email fails on letter confusion (d/e, v/t) and is the known problem on every provider. Alex now confirms by text to `{{lead_phone}}` (asks for a number if blank, reads it back digit by digit).
4. **One combined confirmation of the form details** instead of one question per detail ("I see you asked about a roof inspection for a leak, you own the property, and you'd like it looked at as soon as possible. Did I get that right?").
5. **Offer the two earliest slots** (today first, at least two hours out), five business days widening to ten.
6. **Full address** (street, city, zip): ask once for what is missing.
7. **Background noise rule** ("Sorry, I didn't catch that", once, then "is there somewhere quieter?"); treat odd words as transcription errors.
8. **Booking-failure handling:** retry once, then one honest line ("our scheduling system isn't responding... someone will call you"), accept "ASAP" as a callback time, never ask for a more specific time more than once.
9. **Cal.com tools:** my custom webhook tools first (GET /v2/slots, POST /v2/bookings), then ElevenLabs' native Cal.com integration. Native slots come back in UTC so the prompts convert to Pacific (7 h behind until Nov 1, then 8 h).
10. **Dropped:** the n8n Agents idea (a first-class agent can't replace the workflow: no webhook trigger), Bland.

## Results so far
Only scripted dashboard tests exist. Script 1 was run once on each prompt (2026-10-19, blitz account):

| | v1 strict (`conv_1501m5akjyheenssnw1d1zs4rb6g`) | v2 loose (`conv_4501m5aks4weebg8hxb6wc9x7gvw`) |
|---|---|---|
| Stacked-question turns | 0 of 16 | 0 of 14 |
| Waited for answers | yes | yes |
| AI + recording disclosure right after name check | yes | yes |
| Combined form confirmation | one question | one question |
| False "all set" | no | no |
| Booked | **no**, 3x HTTP 400 | **no**, 3x HTTP 400 |
| Response delay median / worst | 0.66 s / 1.38 s | 0.71 s / 23.2 s (tool retries) |
| Problems | looped asking for a specific callback time 3x after "ASAP" | offered tomorrow's slots before today's earlier ones; "booking that now" in the same turn as the confirmation (no wait for yes); dropped the offer question; two goodbyes |

Root cause of both booking failures (my tool setup, not the platform): the event requires the property address as the booking location and the tool did not send it; and the phone number went in as the literal text `{{lead_phone}}` because dashboard tests have no dialed number and Alex never asked for one. Fixed (native tools, fixed event location, address in notes, prompts changed). **No booking has run end to end since the fixes.** Prompt comparison: tied, since neither has booked. Run 0 (old config) is excluded.

Cost: ElevenLabs list price $0.08/min vs Retell $0.07 to $0.31 (measured 14.5 cents with an ElevenLabs voice); see `PRICING.md`. ElevenLabs is cheaper by roughly 1 to 4 cents a minute, a thin margin. Actual billing not captured yet (Free tier: 15 minutes).

Audit (2026-10-19, before the next tests): live config matches the repo, event slots verified live; known risks are UTC-to-Pacific day boundaries (5 PM Pacific shows as midnight UTC), unconfirmed native tool constants (so prompts pass event ID and time zone explicitly), and a possible duplicate tool exposure (tool_ids plus inline).

## Open items
1. **A real booking end to end** is unverified. Test bookings are cancelled only after Abdullah says so.
2. **No text is actually sent.** Alex says a text is coming; no text tool exists and Cal.com only emails. Add a stub tool, then real send via Twilio after A2P registration (KI-003, task 1.3); trial Twilio only texts verified numbers (Abdullah's and Quentin's).
3. **LLM:** ElevenLabs runs deepseek-v41-flash, Retell runs gpt-4.1. Decide whether to test a stronger model for a like-for-like comparison.
4. **ElevenLabs plan:** Free tier caps calls at 15 minutes total; full rounds (10+ per round) need Creator (about $11). Abdullah's decision.
5. Unverified: outbound-call endpoint body, post-call webhook payload paths, Twilio delivery, answering-machine detection payload.
6. Scorecard still blank for items 3 to 5, 7, 10 to 13; edge-case scripts 3 to 8 not run; verdict not written.
7. Rule flagged for Abdullah's OK: `TEST_PLAN.md` scorecard criteria 3 and 4 (email capture, email readback) don't apply with text confirmation; edit needs his OK.

## Next steps
1. Abdullah re-runs Script 1 on both agents (gives his own cell number when asked), then scripts 3, 4, 6, then 2, 5, 7, 8 if he upgrades.
2. Claude pulls transcripts (`GET /v1/convai/conversations`), scores them in RESULTS.md, fixes anything that fails.
3. Text-confirmation tool (stub, then Twilio). LLM decision.
4. Fill scorecard and billed cost per minute; write the verdict vs Retell Alex Lab; log a decision in `docs/decisions.md` if ElevenLabs wins.
5. Only if it wins: wire the n8n workflow, Twilio number import, post-call webhook.

## Hard rules
No changes to production Alex, Nora, Emily, Kynetic Restoration (Demo), or Cal.com event 7404470. Tell Abdullah and wait for a yes before changing n8n, Retell or Twenty (he asked on 2026-10-19 for Twenty and GitHub to be updated). Never commit secrets (keys live in the cloud environment: `ELEVENLABS_API_KEY_blitz`, `ELEVENLABS_API_KEY_kyneticai`, `CAL_API_KEY`). Test bookings are cancelled only after Abdullah says so.
