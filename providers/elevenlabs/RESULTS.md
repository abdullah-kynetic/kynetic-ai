# ElevenLabs results

Persona and scorecard: `providers/TEST_PLAN.md`. Control: Retell Alex Lab.

## Verification of unverified PROMPT.md items
Status 2026-10-16: not yet verified. The cloud session cannot reach elevenlabs.io or cal.com (DNS failure on WebFetch, HTTP 403 on Firecrawl), so nothing below is confirmed from docs. To be settled in the dashboard / first live calls.
| Item | Status | How to settle |
|---|---|---|
| One-second pause tag (`<break time="1.0s" />`) | Unverified | Put the tag in a test readback; listen for a real pause. Keep " ... " if not honored by the chosen voice model. |
| Current-time variable name (`{{system__time}}`) | Unverified | Open the agent's dynamic variables list in the dashboard and copy the exact system variable name. |
| Cal.com v2 request shapes (slots, bookings, `cal-api-version` header, body fields) | Unverified | Test each server tool in the dashboard against event type 7404470; record the working headers and body here. |

## Runs
| Run | Date | Round (voice email / prefilled) | Stacked-question turns / total turns | Waited for answers? | Email exact? | Readback 1-5 | False "all set"? | Booked? | Delay median / worst | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | |

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
