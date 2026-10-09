# Known issues: Outbound Speed to Lead demo

Build-specific. Global issues live in `docs/known-issues.md`; Twenty wins.

## Open: to verify in the Phase B test
1. Slots lookup: the `check_availability` tool sends its dates in the request body, but Cal.com's slots endpoint reads them from the web address. Vapi may not translate. If Alex finds no slots, this is why.
2. Booking address: `book_appointment` sends the property address as a plain `location` string. Cal.com may need a different format for an attendee-address event.
3. Date line: the prompt uses a Liquid date format for America/Los_Angeles. If Alex states a wrong date, this is why.
4. Test variables: resolved. Talk dropdown > Variables sets per-call values (Oct 9).
5. KB lookup adds delay mid-call; judge in testing.

## Open: known gaps
- Voice is a placeholder ("sarah", not Cimo). Backchannel words and frequency cannot be set on Vapi.
- No server URL: the after-call report goes nowhere until n8n is adapted (only matters if Vapi wins).
- Cal.com free slots have gaps (9:00-11:30, 2:30-4:00 weekdays; none on weekends). A Friday-evening call can only offer Monday or later.
- A test booking creates a real Cal.com appointment; cancel it after testing (needs a yes).

## Gotchas
- Vapi assistant names max 40 characters. Vapi Files fails on `.md`; use `.txt`.
- Cal.com key lives inside the two Vapi tools. Redact before exporting any Vapi tool JSON to git. Rotate the key and update both tools together.
- Session permission checker blocked Vapi calls once in Auto mode (Oct 9). Use Accept edits mode or a permission rule if it recurs.
