# D-014: Outbound v1 architecture: n8n form intake, two endpoints, light pre-call gate

_Twenty note `b6ceab9c`, created 2026-10-07, updated 2026-10-14. Exported 2026-11-12._

## D-014: Outbound v1 architecture
**Status:** decided (corrected Oct 7, 2026, see item 6)
**Date:** 2026-10-07

**Decision:**
1. **Lead entry:** an n8n form for now. It stands in for the client's Meta lead form and can be swapped for the real Meta trigger later. The form carries the consent wording and a consent checkbox (D-007, D-011). Consent text, timestamp and lead source are stored in Twenty with the lead.
2. **Two n8n endpoints:** (a) the n8n intake form, public by design; (b) one post call endpoint that filters on `event == call_analyzed`, with a header auth secret (KI-005). No tools endpoint in v1 (see item 6).
3. **Light pre call gate:** phone format check (E.164), no re-call of the same phone within 24 hours of a new submission, and a consent check. Scheduled retries from D-012 are not blocked by the 24 hour window. Owner qualification stays upstream (D-002).
4. **Opt out logging tool:** not in v1. It comes with compliance task 3.6.
5. **Source Template 05 correction:** it does not contain an action router or any tool webhooks. It has an n8n form trigger, a Vapi call node, a 30 second polling loop, an analyzer and Google Sheets writes. ACTIVE BUILD PLAN Section 4 premise was wrong on this point.
6. **Correction (found in the Emily snapshot):** Retell's check_availability_cal and book_appointment_cal are native Retell tools that call Cal.com directly. They are not n8n webhooks. So the outbound agent needs no tools endpoint, and the earlier three endpoint plan with an action router is replaced by two endpoints. A tools endpoint is only needed later if a custom tool is added (for example opt out logging or human transfer).

**Why:** Keeps v1 to two endpoints and one secret, and matches D-012 (webhook replaces polling).

**Approval still needed before building:** adding the two native Cal.com tools (and end_call) to the new outbound Retell agent is a per change approval under the Retell tools rule. The Cal.com event type must be one for the outbound client niche; Emily's 7025524 is Water Damage Assessment.

**See also:** D-010, D-011, D-012, D-013, ACTIVE BUILD PLAN note Sections 4 to 6.
