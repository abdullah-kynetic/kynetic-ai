# Build Log

Real, dated record of the Kynetic AI platform build — decisions, errors hit, and
how they were actually resolved. GitHub commits are the receipts; this is the
narrative thread connecting them. See `.claude/skills/build-log/` for how this
file gets maintained.

## 2026-08-27 — Vendored SeldonFrame, stood up the first live Vercel deployment

**Did:**
- Evaluated `trycompai/crm` (rejected — built for rep-mailbox enrichment, not
  outbound cold-lead scraping, the wrong shape for Kynetic's actual pipeline)
- Evaluated `seldonframe/seldonframe` — an open-source "AI front office for
  agencies serving local businesses" (website + booking + CRM + AI
  receptionist per client). Direct match to Kynetic's actual business model.
- Vendored the full SeldonFrame codebase into `platform/seldonframe/`
  (`48ce1b0`) after GitHub blocked programmatic repo creation (403 on the
  session's GitHub App) — kept as a subfolder of `kynetic-ai` instead of a
  separate repo.
- Created a Vercel project (`kynetic-ai`, team `abdullahkynetic-projects`),
  connected it to the GitHub repo, set Root Directory to
  `platform/seldonframe/packages/crm`.
- Connected a free-tier Neon Postgres database via Vercel's native Storage
  integration.
- Got the first successful production deployment live at
  `https://kynetic-ai-fawn.vercel.app`.

**Decided:**
- **Keep the existing stack (n8n, Modal, Apify, Retell/Twilio/Cal.com)
  unchanged** — SeldonFrame replaces only Notion-as-CRM and (eventually)
  SeldonFrame's own voice pipeline gets skipped in favor of the already-built
  Retell reference build. Scoped as a headless CRM + event/automation layer,
  not an all-in wholesale platform swap.
- **Route LLM calls through OpenRouter, not Anthropic directly** — verified
  the codebase's `@anthropic-ai/sdk` client never sets an explicit `baseURL`
  anywhere across 25+ call sites, meaning the SDK's built-in
  `ANTHROPIC_BASE_URL` env var auto-read redirects the entire app's LLM
  traffic through OpenRouter's Anthropic-compatible endpoint
  (`https://openrouter.ai/api`) with zero code changes.
- **Neon over Supabase for the database** — the codebase's `db/index.ts`
  imports `@neondatabase/serverless`'s HTTP driver specifically
  (`drizzle-orm/neon-http`), which speaks SQL-over-HTTPS to a Neon-specific
  endpoint, not the standard Postgres wire protocol. A plain Supabase
  connection string would fail outright; making Supabase work would require
  standing up Neon's local proxy translation layer as extra infrastructure
  for no real benefit over just using Neon (also free, also zero-setup via
  Vercel's native integration).

**Hit and fixed:**
- First "successful" deployment was actually building an empty shell —
  tracking `main` (which didn't have the vendored code) with no Root
  Directory set, so Vercel built the bare repo root (`README.md` +
  `automations/`, no `package.json`). Fixed by merging the feature branch
  into `main` and setting Root Directory to
  `platform/seldonframe/packages/crm`.
- `git push` did not reliably trigger a new Vercel build (a known issue —
  SeldonFrame's own internal `deploy-prod` skill explicitly warns about this).
  Worked around it with a manual Deploy Hook + dashboard Redeploy each time,
  since the sandbox's network egress proxy also blocked directly POSTing to
  the deploy-hook URL from this session.
- Build failed: Vercel Hobby plan caps cron jobs at 2 total, once/day max —
  this repo defines 17, several sub-hourly. Fixed by removing the `crons`
  block from `vercel.json` entirely for now (`94fe779`) — none of those
  background jobs matter until real client data is flowing.
- Build failed again: `invalid_max_duration` — two OpenAI Realtime voice
  webhook routes were set to `maxDuration = 800` (Pro/Enterprise ceiling);
  Hobby hard-rejects anything over 300 rather than silently clamping it as
  the code's own comment assumed. Capped both to 300 (`87d16bd`) — no
  functional loss since Kynetic isn't using that voice pipeline (keeping
  Retell instead).

**State at end of session:**
- Live at `https://kynetic-ai-fawn.vercel.app`, build succeeding.
- Neon Postgres connected (`DATABASE_URL` auto-injected).
- Still needed before login/CRM features actually work: confirm the rest of
  the env vars (`AUTH_SECRET`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`,
  `NEXT_PUBLIC_APP_URL`, `ANTHROPIC_API_KEY` via OpenRouter,
  `ANTHROPIC_BASE_URL`, `RESEND_API_KEY`) actually saved in Vercel's
  Environment Variables — unverified from this session's side, since no
  available tool lists a project's configured env vars; only a fresh
  deployment can confirm it indirectly.
- Auth is NextAuth v5 (Google OAuth or Resend magic-link only, no
  password) — neither provider's credentials are configured yet, so the
  login page renders but nothing works yet.

**Open for next session:**
- Confirm/re-enter the remaining env vars in Vercel, redeploy, verify build
  actually completes with DB migrations applied.
- Set up Resend (simplest path) so login actually works.
- Confirm first-user-becomes-owner signup flow works end to end.
- Not yet started: Modal → Postgres write path, feature-flag scope-down,
  Retell/Cal.com real deployment (rotate the leaked Cal.com key first).
