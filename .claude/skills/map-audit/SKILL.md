---
name: map-audit
description: Weekly or after-merge audit that the system map and the context docs still match the repo, Twenty and git. Finds drift, stale cards and leftovers (finished work not recorded, branches merged but still described as unmerged). Read-only. Use for "audit the map", "is anything stale", "weekly check", "what did we leave behind".
---

# map-audit

Read-only. Never edits a live system. Output is a short report plus proposed edits for Abdullah to approve.

## Steps
1. Run `python tools/map_check.py`. Fix nothing yet; list each PROBLEM and note.
2. Stale cards: for each card named STALE, open the card and the changed files, update "If you change this" only if the change affects it, then set `verified_on` and `verified_at` (current commit). If unsure, mark `status: stale` instead of guessing.
3. Leftovers against Twenty (read-only, GET only): list tasks not DONE and compare with `docs/progress.md` In progress / Next / Blockers.
   - Task DONE in Twenty but still listed open in progress.md: propose moving it to Done.
   - Task open in Twenty with no mention in progress.md: propose adding it.
   - Dates in the past (for example a dialing start date) still TODO: ask whether it was done and never ticked.
   - Counts that repeat across files (node counts, D- and KI- ranges, agent and workflow ids): check they agree; on a mismatch write both values, do not pick one.
4. Branches: list remote branches merged into main (propose deleting; deleting needs Abdullah's yes) and unmerged branches the docs still depend on.
5. Product check: for any workflow or agent id in the docs, confirm it still exists with a read-only list call; flag ids that no longer resolve.
6. Report in this order: problems, stale cards, leftovers, branches, proposed edits. End by asking which edits to apply.

## Rules
- Twenty is canonical; the repo mirrors it. Flag, do not pick.
- No live change without Abdullah's yes on that exact change. No secrets in output.
- Update the three docs only through the `build-log` skill.
