# Alex on ElevenLabs: config snapshot (2026-10-19, blitz account)

Read-only copies brought over from draft PR #31 (branch `claude/provider-test-elevenlabs`) because D-025 makes this agent production Alex.

- `agent_8201m5afn2rbeb7v29xfkhh1pjef.json`: Alex v1 strict, the agent D-025 puts live. LLM `deepseek-v41-flash`. Data collection fields: `outcome`, `callback_time`, `booked_slot`, `notes`. Post-call webhook not set (`post_call_webhook_id` null, events `transcript` only).
- `tool_3501m5afmd47fjw842ya61z5kyzq.json` and `tool_2501m5afmdgef4gacn3qsgnxagrs.json`: the two Cal.com tools attached to that agent (`tool_ids`).
- Auth headers in these files are `secret_id` references to ElevenLabs workspace secrets, not secret values.

Not current in one place: the prompt in this snapshot still promises a text. The live prompt since 2026-10-22 is `../../golive/v1-prompt-no-text-2026-10-22.txt`. Before any PATCH, pull the live agent read-only and diff it against this folder.

The v2 loose agent (`agent_9701m5afn5rxehardsqttkq3pbjh`) is not used (D-025) and is not copied here; it stays on the PR #31 branch.
