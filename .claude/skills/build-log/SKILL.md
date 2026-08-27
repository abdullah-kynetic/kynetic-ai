---
name: build-log
description: Run at the end of any Claude Code or Cowork session that changed something in kynetic-ai (built, deployed, debugged, or decided anything). Captures the session into a permanent, portfolio-grade engineering record — a dated entry in BUILD_LOG.md (GitHub, the receipts) plus a prompt to log the same summary to Notion (the narrative). Use when the user says "wrap up," "log this," "document what we did," or at the natural end of a work session on this project.
---

# Build Log

Abdullah is documenting this project (the SeldonFrame/Kynetic CRM build-out) as a
real portfolio piece — for a future AI consulting agency, or as substantiated
proof-of-work for a Solutions Engineer role (Google/Salesforce/AWS-type). The goal
is a paper trail that is BOTH:
- **Real** — actual commits, actual errors hit, actual decisions, not a cleaned-up
  retrospective. GitHub is the receipts.
- **Legible** — a human skimming for 90 seconds can tell what happened and why it
  mattered. Notion (or wherever the narrative lives) is the story.

Never invent detail to make an entry sound more impressive. Every claim in a
BUILD_LOG entry must be traceable to something that actually happened this
session — a real commit SHA, a real error message, a real decision with its
real reasoning.

## What to do, every time this fires

1. **Reconstruct what actually happened this session** from the conversation and
   `git log` — not from memory of what was *supposed* to happen. Look at:
   - Actual commits made (`git log --oneline` since the last BUILD_LOG entry)
   - Actual errors hit and how they were diagnosed (build failures, config
     mismatches, wrong assumptions corrected)
   - Actual decisions made and the reasoning (e.g., "chose Neon over Supabase
     because the codebase's DB client is Neon's HTTP driver specifically, not
     generic Postgres")
   - Current state: what's deployed, what's configured, what's still open

2. **Append one dated entry to `BUILD_LOG.md`** at the kynetic-ai repo root
   (create it if it doesn't exist yet). Format:

   ```markdown
   ## YYYY-MM-DD — <one-line summary of the session's throughline>

   **Did:**
   - <concrete thing, with commit SHA if applicable>
   - <concrete thing>

   **Decided:**
   - <decision> — because <real reasoning>

   **Hit and fixed:**
   - <real error/blocker> → <root cause> → <fix>

   **State at end of session:**
   - <what's live, what's configured, what's still pending>

   **Open for next session:**
   - <specific next step>
   ```

   Keep entries honest about what's still broken or incomplete — an accurate
   record of real debugging is more valuable for a portfolio than a fake
   streak of clean wins.

3. **Commit and push** `BUILD_LOG.md` on its own (don't bundle it into an
   unrelated code commit) with a plain message like `Log session: <one-line
   summary>`.

4. **Prompt for the Notion side** — after the GitHub entry is committed, tell
   Abdullah the entry is ready and ask if he wants it also logged to Notion
   (invoke the `session-close` skill if this session's harness has it
   available) — that's where the narrative/portfolio-facing version lives.
   Don't skip this step silently; the whole point is both halves get done.

5. **If this is the end of a session** (not just a mid-session checkpoint),
   also offer the `session-handoff` skill so the next session picks up cold
   without re-deriving context.

## What NOT to do
- Don't write marketing copy. "Successfully implemented a robust solution"
  is worthless — "the build failed because Vercel Hobby caps maxDuration at
  300s and this route was set to 800; capped it, no functional loss since
  we're not using that pipeline" is the actual content.
- Don't log routine tool calls or conversation back-and-forth — only things
  that changed the repo, the deployment, or a real decision.
- Don't retroactively make earlier entries look better. If a past entry was
  wrong or incomplete, add a note in the new entry — don't edit history.
