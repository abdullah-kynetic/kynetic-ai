# Portal build-out: the client dashboard (portal.kyneticai.com)

Plan only. Nothing here is built or deployed. Source read at `5888b13`; the live server was not touched. Facts about Twenty and the live portal that I did not read are marked **[unverified]**.

## 1. What exists today (verified from `portal/`)

- **Stack:** Next.js 16.4.2, React 19, Tailwind v4, Drizzle + Postgres with forced row-level security, Auth.js v5, zod, recharts, lucide icons. Dark brand theme (`#0a0a0a` background, magenta `#b70dc6` / violet `#7c3aed`) in `src/app/globals.css`; 15 small UI components in `src/components/ui/`.
- **Client side (6 pages):** home, profile, contacts, Plan 1 scope (with a progress bar), timeline, results (charts), documents (download + upload).
- **Admin side:** client list, "New client" form, and per-client tabs: profile, contacts, scope, timeline, results, documents, users, ingest keys. Fifteen admin actions in `src/lib/actions/admin.ts` (create/update client, save profile/contact/scope/milestone, invite and manage users, ingest keys).
- **Data (13 tables):** `clients` (name, slug, status onboarding/active/paused, plan name, included minutes, **`twenty_company_id` already present**), `business_profiles`, `contacts`, `scope_items`, `milestones`, `users`, `documents`, `daily_results`, `ingest_keys`, plus auth tables and `audit_log` (`src/lib/db/schema.ts`).
- **Creating a client today:** an admin fills "New client" by hand; the action creates the client, an empty profile and four default milestones (kickoff, build, testing, go-live) (`actions/admin.ts:40-56`). Scope items, contacts, profile text, invites and ingest keys are all separate manual steps.
- **Integrations in code:** one. `POST /api/ingest/results` takes daily numbers per client. No code in `portal/src` calls Twenty, Retell, Stripe, Cal.com or n8n, and nothing found in the repo or the n8n backup calls the ingest endpoint. `twenty_company_id` is stored and never used.

So today the portal is a well-built **viewer with a manual admin form**. Every automation you described is missing.

## 2. Decision: which side creates the client

**Twenty creates the client; the portal receives it.** One-way push, Twenty to portal, over n8n.

Why: Twenty is already the system of record (D-006) and the sales flow lives there (opportunity to CLOSED_WON, proposal, invoices). A client exists before the portal needs it. Two systems that can both create clients need conflict handling for duplicates, renames and deletes; one direction avoids all of that. The `twenty_company_id` column was clearly meant for this.

Field ownership, so nothing is edited in two places:

| Data | Owner | Direction |
|---|---|---|
| Company / client account identity, contacts, plan, price, services chosen | Twenty | Twenty -> portal |
| Portal users, passwords, MFA, documents, ingest keys | Portal | none (never in Twenty) |
| Scope item status, milestone status, dates | Portal (the build team edits them) | portal -> Twenty (one summary field + a task/note) |
| Daily results (leads, calls, bookings, minutes, speed) | Computed from Twenty/Retell by n8n | n8n -> portal |
| Invoices and payment state | Stripe, mirrored in Twenty | Twenty -> portal (read-only display) |

The admin "New client" form stays as an emergency path but warns "create in Twenty instead".

## 3. Target system (what "everything automated" means)

One trigger, many steps. Starting event: a Twenty opportunity moves to CLOSED_WON (or an admin presses "Onboard" on a client account).

1. **Client creation:** n8n reads the Twenty company, client account, contacts and chosen services, then calls a new portal endpoint `POST /api/sync/clients` (upsert by `twenty_company_id`). Portal creates client, business profile, contacts, and the right scope items and milestones for the chosen services.
2. **Invite:** the primary contact gets a portal invite (existing invite flow). Sent after Abdullah's one-click approval, because it is a message to a customer.
3. **Documents:** the proposal and agreement land in the client's Documents automatically.
4. **Ingest key:** provisioned without a human copying a secret (section 6).
5. **Build tracking:** milestone dates come from the estimator (section 5); when the build team marks a milestone done in the portal, a webhook updates the Twenty record and triggers the matching Stripe invoice step (25% when built and sent for testing, 25% at completion).
6. **Run phase:** a daily n8n job pushes results; a weekly summary and a monthly report are generated from the same data (Twenty tasks 5.6, 5.7).

## 4. Proposals and pricing from a dropdown

A **service catalog** in the database drives everything: each service has a name, what it includes (scope item templates), a price, build time, dependencies, and whether it is live or later.

Flow: admin opens "New proposal" -> picks client -> ticks services from a dropdown -> sees the generated package: scope list, total price, the three-invoice schedule, timeline -> previews -> approves. Only then is a proposal PDF/page produced; nothing is sent automatically (hard rule: customer-facing text is drafted for Abdullah's approval).

- **Priced today:** Plan 1 only. D-024 (supersedes D-017): $6,500 founding for clients 1-3 (50/50, then $1,500/mo), $10,000 standard after (50/25/25, then $2,000/mo); upsells priced in D-024. **Prices for every other system are undecided** (Plan 2 pricing is open), so the catalog ships with Plan 1 priced and the rest as "price: to be set" that blocks proposal generation until you fill them in. I will not invent numbers.
- **Selecting services creates the work:** each selected service expands to its scope items, milestones and a checklist of build tasks (for Alex: Retell agent, n8n workflow, Cal event, form, A2P, test).
- **Agreement text** comes from the attorney-reviewed template (tasks 4.7, 4.8); until then proposals say "agreement to follow".

## 5. Timeline estimator

Each service stores `build_days` and `depends_on`. The estimator lays services on a critical path (things that can be built in parallel overlap; shared setup happens once) and adds external waits as separate lines (A2P registration, attorney review, client approvals) so the date range is honest. Output: "earliest go-live" and "expected go-live" plus the milestone dates written to the client's timeline.

Your examples (outbound alone about 2 weeks; outbound + inbound + CRM lead follow-up about 4 to 6 weeks) are the starting hypotheses. They should be replaced by measured numbers from the Quentin dry run (task 6.1), which is meant to time every step, so the estimator becomes data and not a guess.

## 6. Connections and the hard parts

- **New endpoint `POST /api/sync/clients`:** separate key type from the results ingest key; HMAC body signature required; strict zod schema; idempotent on `twenty_company_id`; own rate limit; audit row per call; admin-scope only. It is a new attack surface, so it ships with tests next to the existing RLS and static-guard tests.
- **Ingest key provisioning:** today a key is shown once and copied by hand (`createIngestKey`). For automation, n8n should create the key through the sync API and write it straight into an n8n credential, never into a message or log. Simplest safe start: one key per client created at onboarding by an admin-scope service call.
- **Per-call data:** the dashboard you want (calls, transcripts, bookings feed) needs more than the daily totals the ingest accepts. Add a `call_events` table (time, outcome, booked slot, summary, speed-to-lead) fed by the post-call workflow; transcripts only if counsel is fine with showing recordings or text to clients **[unverified]**.
- **Prerequisites before real client data:** close KI-006 (DB passwords in the container environment, off-server backups with a restore test, the A/B isolation test) and KI-008 (dev password reuse check).
- **Deploy path** stays `portal-deploy` of a merged `main` commit (D-022); every schema change needs a migration and a deploy.

## 7. UI direction ("easy, accessible, beautiful, AI-first")

- **Client home = one glance:** a hero number (average seconds from lead to first ring), this week's leads, calls, bookings, next appointments, and "what Alex did today" as a plain-language feed.
- **Admin home = command center:** all clients, onboarding stage, blockers, next action per client, results trend; the Plan 1 revenue tracker if you want it here.
- **Onboarding as a guided wizard** (pick services, review, approve), not eight tabs.
- **AI assistance inside the admin, human-approved:** draft the proposal text, draft the welcome message, summarize a client's week. Every AI output is a draft with an Approve button (human-in-the-loop for anything customer-facing or financial).
- **Accessibility pass:** contrast check of the magenta-on-dark pairs, visible focus rings, keyboard paths through dialogs and tables, reduced-motion support, mobile layouts for the client side first. The component set is small enough to audit in one sitting.
- Reuse the Kynetic brand skill and existing tokens; no new visual language.

## 8. Phases

| # | Deliverable | Why first | Live change? |
|---|---|---|---|
| A | KI-006 / KI-008 closed; isolation test run | Nothing else can hold real data | VPS, with your yes |
| B | `twenty_company_id` unique + `POST /api/sync/clients` + n8n "Twenty -> portal" workflow (built inactive) | Replaces manual client creation | Portal deploy, n8n |
| C | Service catalog + proposal builder + estimator | Needs your prices and the 6.1 timings | Portal deploy |
| D | Daily results push from n8n (the missing feeder) + `call_events` | Makes the dashboard real | n8n, portal |
| E | Onboarding wizard + documents auto-filed + invite approval | Cleans up the client experience | Portal deploy |
| F | Stripe milestone invoices wired to milestone completion | Task 4.6 | Stripe, with your yes |
| G | UI redesign and accessibility pass | Easier once data is live | Portal deploy |

Each phase is a separate branch and PR, built inactive/staged first, with tests.

## 9. What I need from you

1. Confirm the decision: Twenty creates the client, the portal receives it.
2. Prices (or "TBD") for each non-Plan-1 service so the catalog can be filled. Until then only Plan 1 can generate a proposal.
3. Which systems go in the first dropdown: outbound speed-to-lead, inbound receptionist, reputation, lead recovery and nurture, text channel?
4. Proposal format: a PDF, or a page in the portal that the client signs off on? (No Google Docs, per your rule.)
5. Are call transcripts or recordings allowed to be shown to clients?
