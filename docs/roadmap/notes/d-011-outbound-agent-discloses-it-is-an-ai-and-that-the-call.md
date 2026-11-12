# D-011: Outbound agent discloses it is an AI and that the call may be recorded

_Twenty note `4c3d0c15`, created 2026-10-06, updated 2026-10-14. Exported 2026-11-12._

## D-011: Outbound agent discloses it is an AI and that the call may be recorded
**Status:** decided
**Date:** 2026-10-06

**Decision:** The outbound speed-to-lead agent states up front that it is an AI assistant and that the call may be recorded. Approved opening line: "Hi, is this {{first_name}}? This is [Name], an AI assistant calling from [Company] about the form you just submitted. This call may be recorded. Is now an okay time?" The consent text, timestamp and lead source are stored in Twenty with every lead.

**Why:** Source review (Oct 6, 2026, 14 saved sources): 4 disclose (03, 04, 05, 09), 3 do not (06, 07, 08), SOURCE TEMPLATE 05 explicitly instructs "Never mention AI", the rest are silent. Only SOURCE TRANSCRIPT 03 argues for disclosure (AI voice ethics best practice). No source gives data on pickup or conversion impact, and none cite a legal basis. Disclosure fits D-007 (consent wording on any form that triggers a callback).

**Consequence:** Drop the "Never mention AI" line from the SolarShift prompt when adapting it. Do not deny being an AI if asked directly. Current federal and state AI-voice disclosure rules have not been verified; counsel to confirm (related to task 1.4).

**See also:** ACTIVE BUILD PLAN note; SOURCE LIBRARY note.
