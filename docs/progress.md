# Progress

Mirror of the Twenty roadmap ("Roadmap: all phases"). If this disagrees with Twenty, Twenty wins.

## Current phase
Phase 3, outbound speed-to-lead build only (D-010). Lane B, the build lane. The whole voice-agent build is being redone from scratch (D-009); see Twenty note "ACTIVE BUILD PLAN: Emily Rebuild + Speed-to-Lead Outbound" for the full synthesis.

## Done
- PR #2 merged: Emily handoff, tools/retell.py, KYNETIC_CONTEXT.md.
- PRs #3-#7 merged: docs memory files, Retell permission rule, repo cleanup (two rounds), build-log docs step.
- 1.1 Cal.com key rotated and confirmed on Emily's two Cal tools (event type 7025524). See docs/known-issues.md KI-001.
- 1.2 Emily's voice kept as 11labs-Cimo. See docs/decisions.md D-008.

## In progress
- None active. Next session should start building the outbound workflow per Section 6 of the ACTIVE BUILD PLAN note.

## Paused (D-010, Oct 6, 2026 — inbound is near-done, left alone until a client demo needs it)
- 3.1 Repoint Emily's 4 tool webhooks and post-call webhook, greeting says Emily. Approved, URL only.
- 3.2 Swap Emily's 13 Notion nodes for Twenty nodes. Needs approval of the node-by-node plan.
- 3.3 Publish the Retell agent (Emily build copy). Was blocked on voice; no longer blocked, but not current work.
- 3.4 Test 3 call paths. Blocked on 3.3 and 1.3.

## Next (active focus)
- 3.5 Build the outbound speed-to-lead n8n workflow as a separate Retell agent (D-010). See ACTIVE BUILD PLAN note Section 6.
- 3.6 Compliance for the outbound workflow: SMS opt-out, Contact relation, webhook auth (KI-005).
- Still need Abdullah's confirmation on Decisions 2 and 3 (n8n webhook pattern; outbound qualification gate scope) before writing the outbound workflow — see ACTIVE BUILD PLAN note Sections 4-5.
- 1.3 Twilio A2P registration for +16692660586 (manual, unrelated to this redo).
- 1.4 TCPA emergency branch opt-out gap, counsel sign-off (manual, unrelated to this redo).

## Blockers
- None currently. RETELL_API_KEY confirmed available in this session; reads and the Cal key update both went through.

## Log
### 2026-10-03
- Read the Oct 1 plan notes and roadmap. Merged PR #2. Added the Retell permission rule. Started docs setup.

### 2026-10-04
- Repo cleanup finished (two rounds): removed unused skill folders, claude-mem, empty placeholders; trimmed CLAUDE.md and skills-breakdown.md.
- build-log skill updated to also refresh the docs/ files at session end.
- Resolved KI-001: confirmed the leaked Cal.com key was live on Abdullah's own account, rotated it, updated Emily's two Cal tools (check_availability_cal, book_appointment_cal), confirmed both validate against event type 7025524.

### 2026-10-05
- 1.2 closed: checked retell/builds/_inflate-original/agent.json, confirmed Emily's current voice (11labs-Cimo) is the same one Inflate's original build used, not an unexamined default. Decided to keep it rather than spend time picking a new one. See D-008.
- D-009: full voice-agent build declared redone from scratch after reviewing 9 YouTube transcripts and 6 build artifacts. Saved all 15 as SOURCE TRANSCRIPT/SOURCE TEMPLATE notes in Twenty and wrote the synthesis into "ACTIVE BUILD PLAN: Emily Rebuild + Speed-to-Lead Outbound."

### 2026-10-06 (audit session)
- Read-only audit of Twenty (50 tasks, 66 notes, 0 opportunities). Synced D-011 and D-012 into docs/decisions.md. Found Twenty task statuses stale: 1.1 and 1.2 still TODO though done, 3.5 not marked IN_PROGRESS. No Twenty writes made.

### 2026-10-06
- D-010: resolved the one-agent-vs-two-agents question from the ACTIVE BUILD PLAN note as two separate Retell agents. Inbound (Emily) paused — near-done, left alone until a client demo needs it. Outbound speed-to-lead is now the sole active build target. Updated the ACTIVE BUILD PLAN note and docs/progress.md, docs/decisions.md to match.
