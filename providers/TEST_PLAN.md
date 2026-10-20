# Voice provider bake-off: shared test plan

Goal: find out which voice AI platform gives the best Alex (outbound speed-to-lead, Kynetic Roofing demo). Retell is the current platform (D-018). This is a bake-off, not a decision. If another provider clearly wins, log a new decision in `docs/decisions.md`; do not edit D-018 silently.

Providers: Retell (control) and ElevenLabs (branch `claude/provider-test-elevenlabs`). Bland (branch `claude/provider-test-bland`) was dropped on 2026-10-19 with no results. Full summary: `providers/BAKEOFF_SUMMARY.md`.

## Rules
- Nothing in this bake-off changes production Alex (`agent_71e3cfc8384aa38a910a506b53`), the n8n workflow `m2YJwZ1l8DTzyEkw`, Twenty, Nora, Emily, or the Kynetic Restoration (Demo) build. Read-only checks are fine.
- Retell control = **Alex Lab** (`agent_423ae0cb2803cba2891b376d44`), same hardcoded persona.
- Only the winner gets wired into n8n. Do not build n8n plumbing for a provider before it wins on conversation quality.
- Secrets stay in the provider consoles or environment variables. Never commit keys.
- Every run that reaches the booking step makes a real booking on Cal.com event type 7404470 (Roof Inspection). Log them and clear them when testing ends (ask Abdullah first).

## Test persona (identical on every provider)
| Variable | Value |
|---|---|
| first_name | Abdullah |
| company_name | Kynetic Roofing |
| agent_name | Alex |
| service_type | roof inspection |
| lead_source | web form |
| owns_property | yes |
| issue_type | a leak |
| timeline | as soon as possible |
| email | (blank, Alex must collect it) |

Caller script: confirm the name, say now is fine, answer the three questions, pick the first offered slot, give any real address, and give a test email **with confusable letters** (B, D, E, T, V) that lands in an inbox you control. Spell it the same way every run. Include a few off-script runs: ask "is this a robot?", say "not interested", say "wrong number, don't call again", stay silent, talk over the agent, give an unclear answer.

## Scorecard (score every provider the same way, at least 10 runs each)
| # | Criterion | How to score |
|---|---|---|
| 1 | One question per turn | Count agent turns containing 2+ questions, out of total turns. Target 0. |
| 2 | Waits for the answer | Count turns where the agent talked past a question or answered itself. Target 0. |
| 3 | Email capture accuracy | Runs where the booked email exactly matched what was spoken. |
| 4 | Readback quality | 1 to 5 by ear: one character at a time, clear pauses, no running together. |
| 5 | Name / data handling | Mishears or mispronunciations of names and addresses, count. |
| 6 | False success | Times the agent said "you're all set" before the booking succeeded. Target 0. |
| 7 | Booking success | Runs ending in a real booking, out of runs that tried. |
| 8 | Response delay | Median and worst gap before the agent speaks (from the platform's latency data if shown, else by ear). |
| 9 | Disclosure and consent | AI + recording disclosure given right after the name check, every run. |
| 10 | Edge cases | Robot question, not interested, wrong number, silence, interruption: pass/fail each. |
| 11 | Voicemail | Hangs up with no message. Pass/fail. |
| 12 | All-in cost per minute | Platform + voice + LLM + telephony, from a real call's billing. |
| 13 | n8n integration effort | Hours to swap: place-call node, post-call webhook, fetch/normalize. |

Retell baseline from the first live test (v1.0 prompt, call_4bfbca5c12d7f5e7f1f2ba04a6a): stacked questions in the opener and the readback, two spellings of the email disagreed, said "you're all set" while the booking had failed, about 14.5 cents a minute all-in (46 cents for 186 seconds), first ring 13.8 seconds after form submit.

## Decision rule
A provider is worth wiring into n8n only if it beats the Retell Alex Lab control on criteria 1, 2, 3, 6 and 7 without losing on cost or delay by more than 25 percent. A tie keeps Retell, because it is already wired and tested end to end.

## Known issue that affects every provider
Spoken emails fail on speech-to-text letter confusion (d/e, v/t). The planned fix is to collect the email on the form so no agent has to spell it, and to send confirmations by text once SMS registration is approved (KI-003). Run the bake-off both ways: with the email collected by voice (stress test) and with the email prefilled (the real target).
