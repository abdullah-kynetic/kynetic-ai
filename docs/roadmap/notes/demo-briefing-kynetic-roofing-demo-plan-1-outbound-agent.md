# DEMO BRIEFING: Kynetic Roofing (Demo), Plan 1 outbound agent

_Twenty note `b68de07d`, created 2026-10-08, updated 2026-10-14. Exported 2026-11-12._

# DEMO BRIEFING: Kynetic Roofing (Demo), built on AM-1 Roofing
**Updated:** Oct 8, 2026 (later). Decision D-016 (amended): the demo is Kynetic Roofing, a copy of the real profile of AM-1 Roofing Inc (Bend, Oregon), a close friend's business, with only the name changed. Full business profile: Twenty note "BUSINESS PROFILE: Kynetic Roofing (Demo)" (attached to the company and client account). Source research: repo retell/builds/outbound-speed-to-lead/demo-business/PROFILE.md.

## Records
- **Kynetic Roofing (Demo)** company (11279a64-6fc3-4c07-933f-217d7827a080): the demo brand. Now carries the real phone (541) 388-3621, address 52 SE 9th St, Bend OR 97702, rating 4.6 from 88. Website not set (Twenty blocks a duplicate domain).
- **Kynetic Roofing (Demo)** client account (56b85831-d0fd-4f0a-a9b7-e96956278bb8): operational record that leads and calls link to. Keep it; the workflow depends on it.
- **AM-1 Roofing Inc** company (6205348e-6a88-4c1b-853e-b397747dd635): the real business as a prospect record. Status NEW, owner gate not formally checked.

## Demo identity (Kynetic Roofing)
- Agent: Alex, an AI assistant. Spoken company name: "Kynetic Roofing" (confirmed Oct 8).
- Market: Bend and Central Oregon, America/Los_Angeles.
- Services (same as AM-1): roof repair and replacement; asphalt, metal, synthetic, tile, wood; flat roof systems (asphalt, coatings, metal, PVC, TPO); also siding, gutters, sheet metal, steel buildings.
- Hours (same as AM-1): Monday to Friday, 8 to 5.
- Offer under test: free 30 minute roof inspection at the property, written estimate after.
- Warranty line in the agent: generic ("manufacturer warranties available"). Real record has CertainTeed Shingle Master, GAF GoldElite and a 20 year GE Enduris coating warranty if Abdullah wants Alex to name them.
- Calendar: Cal.com "Roof Inspection", event type 7404470, attendee address, Pacific time.
- Lead source for now: n8n web form standing in for the Meta lead form.

## Real business facts (copied onto the demo by decision)
- **Website:** am1roofing.com. **Office line:** (541) 388-3621. **Address:** 52 SE 9th St, Bend, OR 97702.
- **Emails (directory listings):** Thomas@am1roofing.com; Olivia@am1roofing.com (one run only).
- **License:** Oregon CCB #108796, active through Nov 9, 2027. **Owners:** Thomas and Jennifer Hunziker (started 1993, incorporated 1995). Thomas Hunziker is the responsible managing individual.
- **Reviews:** CONFLICT. Google roughly 4.5 to 4.9 from 80 to 99 (4.6 from 88 stored). CertainTeed 4.8 from 18 to 19. Themes: quality workmanship, responsive communication, fast completion, clean job sites, fair pricing.
- **Not verified, never state as fact:** Meta lead ads, free estimate/inspection, financing, Facebook page (sources conflict).
- **Contact form:** name, email, phone, preferred contact method, job address, question. Does not say who responds.
- **Gaps we can truthfully point to (as "couldn't find on your site", never as fact):** no booking calendar, no instant quote tool, no financing terms, no stated response time.

## Rules
- Do not dial the AM-1 office number from the demo or from any test. Any call to AM-1 needs the owner's OK first (D-002 gate not formally checked; Abdullah knows the owner).
- A hiring contact number for Thomas turned up in one run. It is not a sales line. Not stored, not for outreach.
- Test calls go only to numbers the tester owns, with consent. The agent says it is an AI and that the call may be recorded (D-011). Consent wording is a draft until counsel signs off (task 1.4).

## Build status
- Retell agent: not created. Abdullah runs `python tools/retell.py create-outbound --apply`. Retell identity verification for outbound: not yet checked.
- n8n workflow "Outbound Speed to Lead": not built; needs the agent ID and the Header Auth credential "Retell API (outbound)".
- Nothing has been dialed.
