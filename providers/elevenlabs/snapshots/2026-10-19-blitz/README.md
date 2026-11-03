# Alex on ElevenLabs: config snapshot (blitz account)

Folder name kept from the first copy (2026-10-19). Contents refreshed from the live agent on 2026-10-28, after the approved fixes below.

- `agent_8201m5afn2rbeb7v29xfkhh1pjef.json`: Alex v1 strict, the agent D-025 puts live (branch `agtbrch_0201m5afn5a5ejxaskex2f5v9zmt`, version `agtvrsn_9301m62055dafs5tssrg9gkkf818`). LLM `deepseek-v41-flash`, timezone America/Los_Angeles.
- `tool_8901m5ar6w5qe2xtpvh4qq522bz7.json` (`calcom_get_available_slots`) and `tool_2801m5ar7r5bf0nrp5fymhva6cbz.json` (`calcom_create_booking`): the two tools on the agent (`tool_ids`). Both use ElevenLabs' built-in Cal.com integration (`api_integration_webhook`, connection `icxn_9201m5am6y02ehpvw4rndr4xzd6p`). Auth is held by that connection; no keys or secret values are in these files.
- Cal.com: both tools pin event type `7520336`, the ElevenLabs test event (same availability as production `7404470`). Bookings made through them are real; switch to a per-client event before go-live.
- The old webhook tools `tool_3501...` / `tool_2501...` from the first copy no longer exist and were removed from this folder.

## Changes made on 2026-10-28 (approved by Abdullah)

1. Prompt: new Guardrail 15 (service area). Only properties in Central Oregon (Bend, Redmond, Sisters, La Pine, Prineville and nearby) are booked. Where the lead lives does not matter. Step 7a now checks the address against it.
2. Prompt: Guardrail 4 confirms opt-outs once ("Understood, we won't call again.") and ends the call.
3. Data collection: `outcome` is a fixed enum: booked, callback_requested, not_interested, do_not_call, disqualified, out_of_area, wrong_number, no_answer, voicemail, booking_failed. `callback_time`, `booked_slot`, `notes` unchanged.
4. Security: `platform_settings.auth.enable_auth` is on. It gates web/SDK sessions behind signed URLs; API-placed phone calls should be unaffected (confirm on the first live test call).
5. Prompt: removed the daylight saving sentence; the rule to convert UTC slots to Pacific time stays.
6. Prompt: example address now includes the zip (97703).

The live prompt is in the agent JSON (`conversation_config.agent.prompt.prompt`). `../../golive/v1-prompt-no-text-2026-10-22.txt` is the earlier version, before these changes.

## Tests (simulation, both Cal.com tools mocked, no real bookings)

01 interested lead books, 02 opt-out, 03 robot question, 04 price question, 05 wrong number, 06 voicemail, 07 out-of-area property (Portland), 08 Florida resident with a Bend property (still books). All pass as of 2026-10-28 (suites `suite_4901m620897kfnb805e6k377a6ks` and `suite_8601m620fj6gekktttj1fypnqbc4`).

## Not done yet

- No post-call webhook (`post_call_webhook_id` null, events `transcript` only). No phone number attached.
- `platform_settings.testing.attached_tests` still lists 4 old test IDs that no longer exist.
- Before any PATCH, pull the live agent read-only and diff it against this folder.

The v2 loose agent (`agent_9701m5afn5rxehardsqttkq3pbjh`) is not used (D-025) and is not copied here; it stays on the PR #31 branch.
