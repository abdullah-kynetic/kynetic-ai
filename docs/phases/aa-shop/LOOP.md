# The AA shop loop: build, test, fix, retest, move on, without coming back

Abdullah starts it once ("do the AA shop loop"). The session then runs every phase and step in `README.md` order and comes back only at the end, or when a stop rule below fires. It inherits `../PROTOCOL.md` (branching, commit rules, no AI trailer, merge-commit when green). Where this file is stricter, this file wins.

## Start

1. Read `docs/STATUS.md`, `docs/known-issues.md`, `../PROTOCOL.md`, this folder's `README.md`, then the first phase file with an unticked step. A new thread resumes at the first unticked step anywhere in the track.
2. Fetch `origin/main`. Branch each phase off the latest `main`: `shop/phase-A`, `shop/phase-B`, and so on.
3. Keep `PROGRESS.md` in this folder: one dated line per finished step, one per fix attempt that failed, one per skipped step. It is the loop's memory.

## The step loop (repeat for every step)

1. **Build** the step as written.
2. **Test** it: run the test the step names, then `bun run verify:quick` in `crm/`.
3. **If anything fails: fix, then retest.** Fix the cause. Never skip, delete, loosen or `.skip` a test to get green. Count attempts. After the same failure survives five distinct fix attempts, stop fixing that step (see Stuck).
4. **Look at it.** For any step that touches a page: load it in the Playwright browser at 1440 px and 390 px wide, take screenshots, and review them yourself. Fix anything broken: overflow, clipped text, overlapping elements, unreadable contrast, a control too small to tap (44 px), missing empty state, dark theme broken. Save screenshots under `docs/phases/aa-shop/shots/<step>/`. Then run the accessibility scan on the page.
5. **Commit** (plain message, no AI trailer), tick the step's `- [ ]` to `- [x]`, add the line to `PROGRESS.md`, **push**.
6. **Next step.** Not before the test passed, the screenshots were reviewed and the push succeeded.

## The phase loop (repeat for every phase)

1. All steps ticked. Run `bun run verify:e2e` for the phase. Anything red goes back into the step loop (fix, retest).
2. Re-review the phase's pages once more at both widths, in light and dark theme.
3. Open the PR. Body starts with the project's attribution lines. Watch CI. If CI fails, fix with new commits and retest. Never rewrite history.
4. When CI is green and there are no conflicts, merge with a merge commit.
5. Append to `docs/progress.md`, and to `docs/decisions.md` / `docs/known-issues.md` only when something changed (the `build-log` skill).
6. **Immediately start the next phase.** Do not ask. Do not report in between.

## Decisions the loop makes itself (so it never needs to ask)

- Copy and layout questions: follow the AA demo (`demos/aa-auto-body-portal/`) and the portal's own design system. Prefer the existing component over a new one.
- A data field that does not exist yet: build the page against a typed empty read function in `crm/src/server/shop/`, show an empty state that says what will appear, and disable the action with the note "Turns on when this is connected". No new tables, no new migrations (except A-S1).
- Anything that would send a text, call or email: never wire it. Show the control disabled.
- Numbers on screen: from real data or clearly labeled sample data. Never invented figures and no unsourced statistics.
- If a step is ambiguous, pick the reading closest to what Edwin said on the call (`README.md`) and record the choice in `PROGRESS.md`.

## Stuck

A step that fails five distinct fix attempts: record what was tried in `PROGRESS.md`, mark the step `BLOCKED`, skip every later step that depends on it, and keep going with the independent ones. Do not stop the loop. Blocked items go in the final report.

## Stop rules (the only reasons to come back early)

- A live step is needed: deploy, applying a migration live, switching a module on, loading sample data into a live account, a server or provider change, DNS. These are recorded in `LIVE-STEPS.md` and the loop continues without them. The loop only waits at the very end.
- A hard rule in `CLAUDE.md` would be broken, or a no-touch item would be touched (Nora, Emily, Retell tools, the live ElevenLabs Alex agent, Kynetic Restoration (Demo) records, `.env` files, secrets).
- A decision only Abdullah or counsel can make that cannot be defaulted by the rules above.

## The end

When every phase is merged (or blocked), write `FINAL-REPORT.md` from `../REPORT-TEMPLATE.md`: every check with proof, the `verify` table, blocked items, what was not verified, and the single consolidated `LIVE-STEPS.md` with the exact commands, in order, each needing a yes. Post it once.
