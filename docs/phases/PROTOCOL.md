# Phase protocol: how a phase runs without coming back for every step

## The loop

1. **Read.** `phase-N.md`, then `docs/STATUS.md`, `docs/known-issues.md` and the `crm/` code the phase touches. Check `origin/main` for newer work first.
2. **Branch.** One branch per phase, off the latest `main`. Never rewrite history, never force-push, never touch `main` directly.
3. **Write the acceptance checks first.** Each check in `phase-N.md` has a proof: an automated test (preferred) or a named piece of evidence. Add the test for a check before or with the code that satisfies it.
4. **Build in small commits.** One concern per commit. Author and committer are `abdullah-kynetic <abdullah@kyneticai.com>`. No AI trailer and no `Co-authored-by` line (`CLAUDE.md`). Check with `git log -1 --format='%an <%ae> / %cn <%ce>'` before pushing.
5. **Verify.** Run `bun run verify` in `crm/` (use `verify:quick` while iterating, `verify:e2e` before the report when the phase touched pages). Fix every failure at its cause. Never skip, delete or loosen a test to get green.
6. **Repeat 3 to 5** until every acceptance check passes and `verify` passes.
7. **Open the PR.** Body starts with the attribution lines the project requires. Watch CI. Fix what CI finds with new commits. Merge with a merge commit when CI is green and there are no conflicts.
8. **Record.** Append dated entries to `docs/progress.md`, and to `docs/decisions.md` and `docs/known-issues.md` when something changed (short, no duplicates), using the `build-log` skill.
9. **Report** with `REPORT-TEMPLATE.md`.

## The step loop

Each `phase-N.md` has a `## Steps` list (P0-S1, P0-S2, ...). For every step, in order:

1. **Finish** the step as written.
2. **Test** it: add or run the test named in the step, then `bun run verify:quick` (full `verify` before the PR).
3. **Commit** it with a plain message (no AI trailer), and tick the step's `- [ ]` to `- [x]` in the same commit.
4. **Push** the branch (`git push -u origin <branch>`, retry network errors up to four times).
5. **Next step.** Do not start it until the test passes and the push succeeded.

A new thread resumes at the first unticked step in the phase file. A step marked STOP waits for a yes; continue with later steps that do not depend on it.

## What "ready to ship" means

All of these, with evidence in the report:

- Every acceptance check in `phase-N.md` passed, each with its proof.
- `bun run verify` (or `verify:e2e` if pages changed) printed `AUTOMATED CHECKS PASSED`, and CI is green on the PR.
- New pages have been loaded in a browser test and checked at a 390 px width, with the accessibility scan clean.
- Anything the session could not check (for example a Docker image build with no Docker daemon, or anything on the server) is listed as **not verified**, never reported as done.

"Ready" is about automated checks. It is not a deploy approval.

## Stop rules (the only times a phase comes back early)

- A live step is needed: deploy, a server or VPS change, a storage bucket change, an n8n activation, a provider key or credential, DNS, Stripe, a real call, text or email. The session lists the exact change and waits for a yes.
- A decision only Abdullah or counsel can make (see the phase file's "Needs a decision").
- The same failure survives five distinct fix attempts. The session reports what it tried.
- A hard rule would be broken to proceed.
- A change would touch a no-touch item: Nora, Emily, Retell agent tools, the live ElevenLabs Alex agent, Kynetic Restoration (Demo) records, `.env` files or secrets.

## What verify covers, and what it does not

`crm/scripts/verify.sh` runs typecheck, lint, format, unit tests, integration tests against Postgres 16, a rehearsal of the deploy scripts, and the production build. `e2e` adds the Playwright browser tests. A step that cannot run counts as not passed.

It does not cover: the Docker image build (CI builds it), anything on the VPS, provider behavior (ElevenLabs, Twilio, Cal.com, Resend), n8n, or whether a page looks right. For pages, the session takes screenshots and reviews them.

## Deploy hand-off

After the report, deploy follows the existing path in `docs/STATUS.md`: check `origin/main`, take the pre-deploy dump, deploy the exact commit, check `https://portal.kyneticai.com/api/health`, and roll back on failure. Each step waits for Abdullah's yes.
