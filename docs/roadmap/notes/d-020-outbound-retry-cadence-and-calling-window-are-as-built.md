# D-020: Outbound retry cadence and calling window are as built (supersedes D-012 item 2)

_Twenty note `9a057779`, created 2026-10-17, updated 2026-10-17. Exported 2026-11-12._

## D-020: Outbound retry cadence and calling window are as built
**Status:** decided
**Date:** 2026-10-17

**Decision:** keep the retry behavior the n8n workflow "Outbound Speed to Lead" (m2YJwZ1l8DTzyEkw) already has. Abdullah chose it over the D-012 retry plan.
1. Attempt 1 goes out on form submit.
2. After a no-answer or voicemail on attempt 1, a fast retry runs about 90 seconds later. If the fast retry does not run, the 5-minute sweeper picks the lead up at +10 minutes.
3. After a no-answer or voicemail on attempt 2, the next try is about 60 minutes later (sweeper).
4. Maximum 3 attempts.
5. Calls only inside 8:00 to 21:00 in the lead's local time (time zone from ZIP, then area code). Outside the window the lead is queued for the local morning.

**Replaces:** D-012 item 2 (retries at 5 minutes, 1 hour and next day, maximum 4 attempts) and the 9:00 to 20:00 Pacific window in the build plan. The rest of D-012 stands.

**Why:** it is what is built, and the first attempt was tested end to end on Oct 15. The retry path itself has not run yet (the only lead booked on the first call).

**Source:** read from the live workflow on Oct 17, 2026 (nodes Wait 90 Seconds, Update Lead After Call, Find Leads Due for Retry, Resolve Lead Timezone). Repo mirror: docs/decisions.md D-020.

**See also:** D-012, D-014.
