---
name: build-log
description: Run at the end of a session that changed kynetic-ai. Updates docs/progress.md, docs/decisions.md, and docs/known-issues.md so they keep mirroring Twenty. Use when the user says "wrap up," "log this," or "document what we did," or at the natural end of a work session.
---

# Session docs update

Twenty is canonical. The three files in `docs/` mirror it. If a doc and Twenty disagree, flag it rather than silently picking one.

Do not recreate `BUILD_LOG.md`. It was the SeldonFrame / Vercel CRM log and was retired; it is recoverable from tag `archive/pre-reorg-2026-10-17`.

## What to do

1. Reconstruct what actually happened from the conversation and `git log`. Do not invent detail.
2. Update `docs/progress.md`: add a dated entry under **Log**, then refresh **Current phase**, **Done**, **In progress**, **Next**, and **Blockers**.
3. Update `docs/decisions.md` only by adding a new `D-NNN` (Status, Date, Why, Replaced). Do not rewrite a past decision. If one is superseded, add the new decision and set the old entry's status to superseded.
4. Update `docs/known-issues.md`: add the next `KI-NNN`. Move fixed items under **Resolved** and record the fix. Do not delete them.
5. If nothing changed for a file, leave it alone.

Never commit secrets. Never modify Nora's agent, LLM, or workflow. Never edit the Kynetic Restoration (Demo) build.
