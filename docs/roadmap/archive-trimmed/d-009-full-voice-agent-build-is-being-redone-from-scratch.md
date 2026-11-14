# D-009: Full voice-agent build is being redone from scratch

_Twenty note `f1361c2c`, created 2026-10-05, updated 2026-10-14. Exported 2026-11-12._

## D-009: Full voice-agent build is being redone from scratch
**Status:** decided
**Date:** 2026-10-05

**Decision:** The entire voice-agent build (Emily rebuild + new outbound speed-to-lead agent/workflow) is being redone from scratch, not incrementally patched. Abdullah's words: "The entirety of the build is completely being redone... Anything that you have that is similar is completely wrong."

**Why:** After reviewing 9 YouTube build transcripts (SOURCE TRANSCRIPT 01-09) and 6 uploaded build artifacts (SOURCE TEMPLATE 01-06) on Retell/Vapi outbound voice-agent builds, Abdullah concluded the existing build approach and assumptions were wrong and the new build should be synthesized fresh from the best patterns across all 15 sources rather than extended from what existed before this point.

**What this supersedes:** Any prior assumption that Phase 3 tasks (3.1-3.7) were simple incremental edits to the existing Emily n8n workflow/Retell agent. The confirmed-done items (1.1 Cal.com key, 1.2 voice choice) still stand and are not being redone. Everything else in Phase 3, especially the outbound/speed-to-lead side (3.5), is being architected fresh.

**Replaced:** The prior implicit plan of patching Emily's existing n8n workflow and bolting outbound onto it with minimal changes.

**See also:** Note "ACTIVE BUILD PLAN: Emily Rebuild + Speed-to-Lead Outbound (Oct 5, 2026)" for the actual synthesized plan and the three open architecture decisions still pending Abdullah's confirmation (one agent vs two, consolidated vs per-tool webhooks, outbound qualification gate scope).
