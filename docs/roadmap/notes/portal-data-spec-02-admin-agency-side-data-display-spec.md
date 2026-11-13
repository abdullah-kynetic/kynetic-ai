# PORTAL DATA SPEC 02: Admin / agency side — data & display spec

_Twenty note `d7daa4c4`, created 2026-11-10, updated 2026-11-10. Exported 2026-11-12._

> **Status:** PROPOSED spec, written Monday Nov 9, 2026. Every volume, rate, price and sample value below is **proposed example (mock) data, not real**. Nothing has been seeded into the portal. Seeding waits on Abdullah's decision: real vs synthetic demo leads. Sources: portal repo main 84332586 (PRs #143–#150 merged), read-only queries on the production portal DB (Nov 9, 2026, 6:40 PM PST), the Portal Blueprint page, and `portal-batches/PLAN.md`.

## Who sees what
- **Admin** (Kynetic owner, TOTP required): everything below.
- **VA**: client list, overview, checklist, users (client invites/resets), audit, support, view-as with a reason. No prompts, billing, usage/margin or agency pages.
- **Client owner/staff**: never see admin pages, provider cost, margin or billing.

## Key formulas (as coded on main 84332586)
- **Leads (client):** contacts created in the range (not deleted). Rolled into `metrics_daily.leads` each day.
- **Speed to lead:** median minutes from a website-form lead (`contacts.source = 'form'`, not imported) to its first outbound call in the range.
- **Contacts reached:** distinct contacts with an outbound call whose outcome is not voicemail/no_answer.
- **Booked (estimates booked):** appointments created in the range with status scheduled, completed or no_show.
- **Booking rate:** round(booked ÷ leads × 100) %. Empty when there are no leads.
- **Won revenue:** sum of `deals.value_cents` won in the range where Alex called or booked that deal.
- **Guarantee:** target = ceil(baseline × 1.2), baseline = admin override or appointments in the 30 days before start; progress = booked in window ÷ target.
- **Health score:** see All clients row below.
- **Provider cost / margin / cap:** cost = call cost + message cost; margin = recorded monthly fee − cost; cap "watch" at 80%.
- **Agency pick rate / reply rate:** see Agency home rows.
- **MRR (target):** Σ active monthly module fees after discount. Not computed yet (prices decision).

## Page-by-page
| Area | Route | Page | Data element | Meaning / formula | Source | Display type | Filters / range | Who sees it | Now on prod | Blocked by |
|---|---|---|---|---|---|---|---|---|---|---|
| Clients | /admin | All clients | Client name → overview link | Each tenant | `tenants` | Data table row | — | Admin, VA | 13 rows | — |
| Clients | /admin | All clients | Plan + tier | Commercial plan (founding/value) and value tier T1–T3 | `tenants.plan`, `pricing_tier` | Table column | — | Admin, VA | founding, tier empty | Prices decision for tier meaning |
| Clients | /admin | All clients | Leads (30d) | Count of contacts created in last 30 days | `admin_tenant_overview()` over `contacts`/`metrics_daily` | Table column (number) | Fixed 30 days | Admin, VA | 0 | — |
| Clients | /admin | All clients | Bookings (30d) | Appointments created in last 30 days with status scheduled/completed/no_show | `appointments` | Table column | Fixed 30 days | Admin, VA | 0 | — |
| Clients | /admin | All clients | MRR inputs | Today: count of enabled modules. Target: monthly recurring revenue = Σ active `tenant_billing_modules.monthly_cents` × (1 − discount) | `tenant_modules`, `tenant_billing_modules` | Table column (should become $) | — | Admin only for $ | "N modules" | BLOCKED: prices |
| Clients | /admin | All clients | Health score | Average of 5 parts (0–100 each): booking rate×100, min(leads30,20)×5, integrations (100 − 10×errors), login recency (≤7d 100, ≤30d 60, else 0), has leads (100/0). Green ≥70, yellow ≥40, red <40 | `calculateHealthScore` (`server/admin/overview.ts`) | Status chip | — | Admin, VA | all red/low (no data) | — |
| Clients | /admin/clients/[id] | Client overview | Profile: status, owner, phone, time zone, hours, service area, services | Tenant profile | `tenants`, `memberships` | Key/value card | — | Admin, VA | partly empty | — |
| Clients | /admin/clients/[id] | Client overview | Systems | Which systems are on | `tenant_modules` | Chip list | — | Admin, VA | platform, alex_core | Six-systems decision |
| Clients | /admin/clients/[id] | Client overview | Pipeline snapshot | Deals and value per stage | `deals`, `pipeline_stages` | Stage list with counts (proposed: horizontal funnel bar) | — | Admin, VA | "No pipeline yet" | — |
| Clients | /admin/clients/[id] | Client overview | Booking guarantee + measurement start | Baseline override or measured 30 days before start; target = ceil(baseline×1.2); booked in 30-day window | `tenants.guarantee_*`, `appointments` | Progress bar + editable date/number form | 30-day window | Admin edits; VA reads | not set | Guarantee baseline policy |
| Clients | /admin/clients/[id] | Client overview | Spend cap | Monthly provider-cost ceiling for this client | `tenants.monthly_spend_cap_cents` | Number form | — | Admin | empty | — |
| Clients | /admin/clients/[id] | Client overview | Recent activity | Latest timeline events for the tenant | `activities` | Feed list | Latest N | Admin, VA | "No activity yet" | — |
| Clients | /admin/clients/new | Onboard a client | Business, slug, owner email, phone, industry template, time zone, hours, ZIPs, site, logo, color, plan, tier, modules, CRM level | Creates tenant + owner invite | `tenants`, `invitations`, `tenant_modules`, `pipeline_stages` | Multi-section form | — | Admin | used for 0 real clients | Six systems as modules; pools/windows templates |
| Clients | /admin/clients/[id]/systems | Per-client systems | System on/off, CRM capability set (core/extended), change history | Toggle a system for a client | `tenant_modules`, `audit_log` | Toggle table + history table | — | Admin | 2 on per client | Cadence/copy overrides: n8n vs worker |
| Clients | /admin/clients/[id]/alex | Client Alex config | Provider, agent ref, voice, greeting, prompt versions, transfer number, paused | Alex setup per client | `alex_configs`, `alex_prompts` | Form + prompt version list | — | Admin (VA cannot change prompts) | all empty, fake, paused | Test call: hard rule |
| Clients | /admin/clients/[id]/billing | Client billing profile | Billing start, Stripe customer id, discount, notes; per-module setup + monthly snapshot; totals | What the client pays | `tenant_billing`, `tenant_billing_modules`, `module_prices` | Form + line-item table + totals | — | Admin only | empty | BLOCKED: prices |
| Clients | /admin/clients/[id]/checklist | Setup checklist | Step, status (todo/doing/blocked/done/n/a), owner, due, note | Onboarding progress; % done = done ÷ (all − n/a) | `onboarding_steps` | Checklist table + progress % | Status | Admin, VA | 0 steps | Regenerate from system templates |
| Clients | /admin/clients/[id]/documents | Client documents | Kind, title, uploaded, superseded | Agreements, proposals, invoices, reports | `tenant_documents` + storage | File list with upload/replace/delete | Kind | Admin | 0 | — |
| Clients | /admin/clients/[id]/imports | Imports | Batch: entity, file, rows total/ok/failed/duplicate, status, undo | Lead/company/deal/note import history | `import_batches`, `import_batch_records` | Wizard + history table | — | Admin | 0 | — |
| Clients | /admin/clients/[id]/presence | Online presence (admin) | Presence items; review snapshot entry | Reputation tasks and manual rating capture | `presence_items`, `review_snapshots` | Task table + form | — | Admin | 3 snapshots | No GBP/review connector |
| Clients | /admin/clients/[id]/reports | Reports | Report day, monthly ROI reports, status | Monthly report scheduling | `reports`, schedules | Form + list | Month | Admin | 0 | Email delivery off by default |
| Clients | /admin/clients/[id]/webhooks + service-tokens | Webhooks & tokens | Intake URL, last rotated, n8n push URL, token prefix, last used, revoked | Lead intake + n8n auth | `tenant_secrets` (encrypted), `service_tokens` | Settings card + token table | — | Admin | 0 tokens | n8n vs worker |
| Clients | /admin/clients/[id]/offboard | Offboarding | Export status, size, ready time; deletion due date | Client exit with data export; never auto-deletes | `tenant_exports`, `tenants.offboarded_at`, `deletion_due_on` | Form + export list | — | Admin | 0 | — |
| Clients | /admin/system-requests | System requests | When, client, system | Client asked for a system that is off | `system_requests` | Data table | — | Admin, VA | 0 | — |
| Clients | /admin/templates | Template library | Industry templates (services, stages) and system templates (turns on, default automations); apply to client | Build once, toggle per client (his GoHighLevel model) | Code constants (`industry-templates.ts`) + `automation_templates` | Card grid + apply form | — | Admin | roofing, restoration, HVAC, plumbing, remodeling, general | Template create/versioning: six systems; pools/windows stages: content |
| Ops | /admin/usage | Usage & margin | Per client: minutes, calls, SMS, emails, provider cost, recorded fee, margin, cap status | Provider cost = call_cost + message_cost; Margin = recorded monthly fee − provider cost; cap status: under / at 80%+ / reached / no cap | `usage_daily`, `tenant_billing_modules`, `tenants.monthly_spend_cap_cents` | Data table + CSV export (proposed: stacked bar of cost vs fee) | Month picker | Admin only (clients never see) | 26 zero rows | Prices (fee); clients-see-cost decision |
| Ops | /admin/operations | Operations | Outbound pause (global), integration health (kind, status, errors, last error, A2P), recent jobs (job, state, retries, created), failed webhooks (replay), flagged calls, admin alerts | Platform health and safety switch | `platform_settings`, `integrations`, pg-boss, `webhook_events`, `calls.flagged`, `staff_notifications` | Big status button + 4 tables + alert list | — | Admin (VA read) | outbound_paused = false; OUTBOUND_ENABLED=false in env | — |
| Ops | /admin/users | Users | Email, client, role, status, last sign-in, actions | Everyone with a login | `users`, `memberships`, `invitations`, `sessions` | Data table + search + client filter | Client | Admin; VA invites/resets client users | 1 user | — |
| Ops | /admin/audit | Audit log | When, client, user, action, entity, before/after | Append-only trail (24 months) | `audit_log` | Data table + detail | Client, actor, action, date | Admin, VA | 4 rows | Archive destination for >24 months |
| Ops | /admin/backups | Backups | Kind, started, status, size, offsite key, restore drill passed | Nightly encrypted backups | `backup_runs` | Data table | — | Admin runs; VA reads | 6 runs | — |
| Ops | /admin/view-as | View as client | Client picker, reason, read-only/write window | Audited impersonation | `impersonation_sessions` | Form | — | Admin, VA (reason required for VA) | — | — |
| Ops | /admin/support | Support | Subject, client, category, status, thread | Client requests and replies | `support_requests`, `support_request_messages` | Queue table + thread | Status (open first) | Admin, VA | 0 | Support emails: decision |
| Agency | /admin/agency | Agency home | This month: revenue, expenses, net | Revenue = won deal value + manual revenue in the Pacific month; Net = revenue − expenses | `deals`, `agency_revenue_entries`, `agency_expenses` | 3 KPI cards | Current month | Admin | workspace not created | Real vs synthetic demo leads |
| Agency | /admin/agency | Agency home | Last seven days: pick rate, reply rate | Pick rate = answered call outcomes ÷ call attempts; Reply rate = contacts with an inbound message after our first outbound ÷ contacts messaged | `agency_call_attempts`, `calls`, `messages`, `agency_dm_logs` | 2 KPI cards (proposed: 30-day line chart) | Fixed 7 days | Admin | — | same |
| Agency | /admin/agency | Agency home | Lead source counts; lead list (name, stage, source, state, lost reason) | Kynetic's own prospects | `contacts`, `deals` in the agency tenant | Bar list + filterable table | Source, stage | Admin | — | same |
| Agency | /admin/agency | Agency home | Agency alerts | new_lead, daily_digest | `agency_alerts` | Alert list | — | Admin | — | same |
| Agency | /admin/agency/dialer | Human dialer | Next lead, script, campaign filter, outcome buttons, callbacks | Human cold calling (no auto-dial) | `agency_call_attempts` (no_answer, voicemail, connected, interested, not_interested, callback, dnc) | Focus card + outcome buttons + callback list | Campaign | Admin | — | same; AM-1 must stay DNC |
| Agency | /admin/agency/campaigns | Campaigns | Campaign, steps, enrolled, due tasks, done/skipped counts | Manual multi-step follow-up | `agency_campaigns`, `agency_campaign_progress`, `agency_campaign_history` | Table + task queue | Campaign, due | Admin | — | same |
| Agency | /admin/agency/inbox + compose | Inbox / compose | Messages by channel/direction; drafts with status (draft/blocked/simulated) and block reason | Conversations; nothing is sent | `messages`, `agency_dm_logs`, `agency_message_drafts` | Message list + draft form | Channel, direction | Admin | — | DNS/MX + A2P for inbound; outbound rule |
| Agency | /admin/agency/proposals | Proposals | Per deal: problem, AI solution, roadmap, ROI, revision; PDF | Sales proposals (prices say "to be confirmed") | `agency_proposals` | List + editor + PDF preview | Deal | Admin | — | Prices |
| Agency | /admin/agency/contracts | Contracts | Deal, title, status (draft/sent/signed/void), sent on, signed on, signed PDF | Manual contract tracking (no e-sign) | `agency_contracts` | Table + form | Status | Admin | — | E-sign provider not chosen |
| Agency | /admin/agency/billing | Agency billing | Deal terms (setup, monthly, installments); invoice ledger (draft/open/paid/past_due); dunning drafts | What each signed client owes; stub provider only | `agency_deal_terms`, `agency_invoice_drafts`, `agency_dunning_drafts` | Forms + ledger table | Status | Admin | — | Stripe test mode + yes; prices |
| Agency | /admin/agency/finance | Finance | Monthly revenue (won + manual), expenses (vendor, category, amount), net per month; referrals (new/approved/declined); case studies (idea→published) | Agency P&L and growth assets | `agency_revenue_entries`, `agency_expenses`, `deals.won_at`, `agency_referrals`, `agency_case_studies` | Monthly table + CSV, forms, status lists (proposed: monthly revenue vs expense bar chart) | Month, tab | Admin | — | same |
| Agency | /admin/agency/ops | Agency ops | Daily summary preview, client health list, DEV webhook + workflow, secret status | Ops glue to n8n | `agency_ops_settings`, `tenant_secrets` | Cards + list | — | Admin | — | n8n vs worker (re-point to production n8n) |

## Display notes
- No page uses a real chart yet. `recharts` 3.10 and `components/ui/chart.tsx` are installed but unused; the dashboard's daily activity and lead-source bars are plain CSS. Recommended charts: line chart for daily leads/booked (client dashboard, admin overview), funnel bar for pipeline, stacked bar cost vs fee (usage), monthly revenue vs expense bars (finance), rating trend line (reviews, when built).

## Agency-side mock data
- **Mock data needed for the agency side:** The agency workspace (`agency_workspaces`, key `kynetic_synthetic`) does not exist on production, so every /admin/agency page shows "Create the agency workspace first". Proposed synthetic set: 60 fictional prospect businesses in TX (not FL/OK, never AM-1), stages across the agency pipeline, 150 call attempts over 30 days (pick rate ~25%), 2 campaigns, 20 DMs, 6 proposals, 3 contracts (1 signed), deal terms for signed deals, 2 invoices, 8 expenses ($ tools/ads), 2 referrals, 2 case-study ideas.

## Open decisions that block admin data
| Decision | Blocks |
|---|---|
| Prices | MRR on All clients, billing profile, proposal pricing, recorded fee/margin on Usage |
| Real vs synthetic demo leads | Agency workspace on production, all agency mock data, all client mock data under real business names |
| n8n vs portal worker | Automation cadence/copy overrides, real automation runs, review requests, agency ops re-point |
| Six systems as modules | Module list, template create/versioning, checklist regeneration |
| Calendar (Cal.com vs client calendar) | External event sync on appointments |
| Clients see usage cost | Client usage page |
| Guarantee baseline policy | Any change beyond admin override + 30-day default |
| Recordings visibility + counsel wording | Call recordings, disclosure text, terms gate |

