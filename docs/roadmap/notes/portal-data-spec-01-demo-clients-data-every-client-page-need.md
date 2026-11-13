# PORTAL DATA SPEC 01: Demo clients — data every client page needs

_Twenty note `b8068a49`, created 2026-11-10, updated 2026-11-10. Exported 2026-11-12._

> **Status:** PROPOSED spec, written Monday Nov 9, 2026. Every volume, rate, price and sample value below is **proposed example (mock) data, not real**. Nothing has been seeded into the portal. Seeding waits on Abdullah's decision: real vs synthetic demo leads. Sources: portal repo main 84332586 (PRs #143–#150 merged), read-only queries on the production portal DB (Nov 9, 2026, 6:40 PM PST), the Portal Blueprint page, and `portal-batches/PLAN.md`.

## The 13 demo clients (what they really are)
All 13 are **real Texas businesses loaded as prospect tenants** from public facts only (`crm/src/server/db/seed/prospects.ts`, checked Nov 2–3, 2026). None has signed, none has users, and every activity table is empty. They are not fictional demo companies like the repo's `demo-a`, `demo-b` and `demo-sales` seed tenants (Ridgeline Roofing, Cedar Valley Exteriors, Summit Home Services), which are not in production. **Putting invented leads, calls or revenue under a real company name is exactly the "real vs synthetic demo leads" decision**, so this spec proposes the data but nothing is seeded.

| # | Client (slug) | Niche | City / metro | Public phone | Active Meta ads (Nov 3) | Public reviews | Twenty company |
|---|---|---|---|---|---|---|---|
| 1 | Super Roofer LLC (`super-roofer`) | Roofing | Houston / Greater Houston | +1 832-707-9085 | 8 | — | None (Twenty has no company record for any of the 13) |
| 2 | DR Roofing & Construction (`dr-roofing-construction`) | Roofing | Houston / Greater Houston | +1 281-815-2422 | 15 | Owens Corning: 426 reviews, 4.8 | None (Twenty has no company record for any of the 13) |
| 3 | FairClaims Roofing & Construction (`fairclaims-roofing`) | Roofing | Spring / Greater Houston | +1 281-367-0466 | 4 | — | None (Twenty has no company record for any of the 13) |
| 4 | Fortbend Roofing Texas (`fortbend-roofing-texas`) | Roofing | Houston / Greater Houston | — (not found) | 8 | — | None (Twenty has no company record for any of the 13) |
| 5 | Rodriguez Roofing (`rodriguez-roofing`) | Roofing | Houston / Greater Houston | — (not found) | 3 | — | None (Twenty has no company record for any of the 13) |
| 6 | BlueWater Pools, LLC (`bluewater-pools`) | Custom pools | Crowley / DFW (Fort Worth side) | +1 817-297-7120 | 8 | — | None (Twenty has no company record for any of the 13) |
| 7 | Tidal Wave Custom Pools (`tidal-wave-custom-pools`) | Custom pools | Frisco / DFW (North) | +1 214-906-8991 | 7 | — | None (Twenty has no company record for any of the 13) |
| 8 | Kelley Pools and Outdoor (`kelley-pools-outdoor`) | Custom pools | Van Alstyne / North Texas / DFW (North) | +1 903-818-2019 | 3 | — | None (Twenty has no company record for any of the 13) |
| 9 | Clarity Windows And Doors (`clarity-windows-doors`) | Windows and doors | Coppell / DFW | +1 972-393-3991 | 22 | Yelp: 31 reviews, 4.5 | None (Twenty has no company record for any of the 13) |
| 10 | Bridgewood Windows & Doors (`bridgewood-windows-doors`) | Windows and doors | Allen / DFW (North) | +1 214-380-9628 | 5 | — | None (Twenty has no company record for any of the 13) |
| 11 | Kitchens Alive LLC (`kitchens-alive`) | Remodeling (kitchen and bath) | McKinney / DFW (North) | +1 214-789-0146 | 10 | — | None (Twenty has no company record for any of the 13) |
| 12 | Manta Construction Company (`manta-construction`) | Remodeling (kitchen and bath) | Coppell / DFW | — (not found) | 8 | — | None (Twenty has no company record for any of the 13) |
| 13 | 123 Remodeling (`123-remodeling`) | Remodeling (kitchen and bath) | Farmers Branch / DFW | +1 469-949-5775 | 12 | Yelp: 3 reviews, 5.0 | None (Twenty has no company record for any of the 13) |

Niche split: 5 roofing, 3 pools, 2 windows/doors, 3 remodeling. Note: D-023 dropped roofing as a target niche, and the current first-sales focus is remodelers. AM-1 Roofing (do-not-call) is **not** one of the 13.

## What exists today vs what is missing (production, Nov 9, 2026)
| Data | Exists now | Missing / needed |
|---|---|---|
| Tenant profile (`tenants`) | 13 rows: name, slug, status onboarding, plan founding, time zone America/Chicago, city/state, niche services; transfer number on 9 | Business hours, ZIP service area, avg job value, pricing tier, logo, brand color, email sender name, recording disclosure, guarantee baseline + start date, go-live date, spend cap, `twenty_company_id` |
| Business record (`companies`) | 13 rows: the business itself, with website, address, niche, ad count, public notes | Real customer companies (the table is meant for the client's customers) |
| Users / team | 0 client users, 0 invites (only abdullah@kyneticai.com as admin) | 1 owner + 1 staff per demo client |
| Systems (`tenant_modules`) | platform + alex_core on for all 13 | Niche system set; CRM level; system requests |
| Alex (`alex_configs`) | 13 rows: provider fake, paused, all fields empty | Greeting, questions, booking rules, call windows, retry, transfer number |
| Pipeline | 1 pipeline + 8 generic stages each | Niche stages; 0 deals |
| Leads, deals, calls, messages, appointments, tasks, notes, activities, consents | 0 rows each | All of it (volumes below) |
| Automations + runs | 6 global templates; 0 per-client automations, 0 runs | Enabled automations + run history |
| Metrics (`metrics_daily`) | 26 rows (Nov 9–10), all zeros | Recomputed by the rollup from seeded records; 90 days |
| Usage (`usage_daily`) | 26 rows, all zeros | Provider cost per day (admin only) |
| Reviews (`review_snapshots`) | 3 real snapshots (DR Roofing 426 @ 4.8; Clarity 31 @ 4.5; 123 Remodeling 3 @ 5.0) | Monthly snapshots; presence items |
| Reports, support, documents, notifications, onboarding steps | 0 | Oct report, 2–3 support threads, sample docs, notifications, checklist |

## Per-page data requirements (client side)
| Route | Page | Data element | Source table / field | Display type | Filters / range | Now on prod | Proposed mock |
|---|---|---|---|---|---|---|---|
| /dashboard | Dashboard | KPI cards: Leads, Speed to lead (median min), Calls, Reached, Booked, Booking rate %, Revenue | `metrics_daily` (rolled up nightly from contacts, calls, appointments, deals); speed-to-lead computed live from `contacts.source='form'` → first outbound `calls.started_at` | 7 KPI cards | Date range: 7 / 30 / 90 days presets + custom from/to | 26 rollup rows, all zero | 90 days of underlying records so every preset fills |
| /dashboard | Dashboard | Lead sources | `contacts.source` count in range | Horizontal bar list (CSS bars) | Same date range | Empty | Source mix per client (see profile) |
| /dashboard | Dashboard | Daily activity | `metrics_daily` per day (leads, booked) | Column chart (CSS bars today; recharts is installed and recommended for a proper line/bar chart) | Same date range | Empty | Daily leads with weekday/weekend pattern |
| /dashboard | Dashboard | Recent activity | `activities` (type, summary, actor user/alex/automation) | Feed list | Latest N | Empty | ~8 activities per lead |
| /dashboard | Dashboard | Booking guarantee | `tenants.guarantee_baseline_bookings` (or 30 days before `guarantee_start_date`), appointments in 30-day window; target = baseline × 1.2 rounded up | Progress bar + sentence | Fixed 30-day window from start date | Not set (baseline and start date NULL) | Baseline + start date per client (profile) |
| /dashboard | Dashboard | Setup progress (owner, until go-live) | `onboarding_steps`, `tenants.go_live_at` | Checklist card | — | 0 steps | Either go-live set 45 days ago (card hidden) or ~10 steps for one "onboarding" demo |
| /dashboard/contacts | Leads list | Name, phone, email, status, source, tags, owner, created + custom columns | `contacts`, `tags`, `memberships`, `custom_field_defs` | Data table (search, filters, column toggle, paging, bulk edit, CSV export) | Status, source, tag, owner, created date | 0 | 90 days of leads (see volumes) |
| /dashboard/contacts/[id] | Contact page | Details, phones/emails, consent per channel, tags, tasks, timeline, notes | `contacts`, `consents`, `tags`, `tasks`, `activities`, `notes` | Detail panel + timeline list + rich-text notes | Timeline type filter | 0 | Every lead gets consent (express_written for form leads), 4–10 timeline events |
| /dashboard/deals/[id] | Deal page | Value, stage, service type, expected close, owner, source, won/lost, lost reason, people with roles, timeline | `deals`, `pipeline_stages`, `deal_contacts`, `activities` | Detail panel + list | — | 0 | One deal per lead |
| /dashboard/pipeline | Pipeline board | Stage columns with count and total value; deal cards | `pipelines`, `pipeline_stages`, `deals` | Kanban board | Owner, source (batch 2) | Stages exist (generic 8 per client), 0 deals | Deals spread across stages (see funnel) |
| /dashboard/tasks | Tasks | Grouped tasks, assignee, due, priority | `tasks` | Grouped list | Mine / all, due buckets | 0 | ~0.6 tasks per lead (call back, send quote, confirm appointment) |
| /dashboard/companies | Companies | Name, phone, contacts, deals | `companies` + roll-ups | Data table + detail page | Search | 1 row per tenant = the business itself (seeded from prospects) | 2–5 customer companies (property managers, builders); keep the self row or move it to the tenant profile |
| /dashboard/appointments | Appointments | Booked estimates with contact, time, address, status, booked_by | `appointments` | Calendar (month / week / day, batch 2) + book form | View switch, date | 0 | Booked count over 90 days, statuses scheduled/completed/no_show/cancelled |
| /dashboard/calls | Calls | Time, contact, direction, duration, outcome chip, sentiment | `calls` | Data table | Outcome, direction, from/to, page size | 0 | ~1.9 call attempts per lead |
| /dashboard/calls/[id] | Call detail | Recording player, transcript, summary, extracted fields, disclosure | `calls` (+ recording object) | Player + transcript + key/value panel | — | 0 | Transcript + summary for reached calls; no audio for mock (player hidden) — recording visibility is an open decision |
| /dashboard/messages | Messages log | Channel, direction, status, error, body | `messages` | Data table / log | Channel, status, date | 0 | ~2.5 messages per lead (SMS shown as mock only; real SMS blocked until A2P) |
| /dashboard/reports | Reports | Monthly ROI report cards; report page totals + review snapshots | `reports`, `metrics_daily`, `review_snapshots` | Card list + report detail (KPI totals) | Month | 0 | Oct 2026 report (ready) per client; Nov in progress |
| /dashboard/presence | Online presence | Presence tasks; review snapshots | `presence_items`, `review_snapshots` | Task list + snapshot table | — | 3 real review snapshots (DR Roofing, Clarity, 123 Remodeling) | 4–6 presence items; monthly review snapshots (real public ones stay real; mock ones flagged) |
| /dashboard/notifications | Notifications | New lead, booked, task due, report ready, hot lead, support reply | `notifications` | Tabbed list + unread count | Unread / all | 0 (no client users exist) | ~1 per lead for the owner user |
| /dashboard/documents | Documents | Agreement, proposal, invoice, report PDFs | `tenant_documents` + storage | List with download | Kind | 0 | Agreement + proposal placeholder PDFs marked SAMPLE |
| /dashboard/support | Support | Requests with status, category, thread | `support_requests`, `support_request_messages` | List + thread view | Status | 0 | 2–3 threads per client (general, alex_change) |
| /dashboard/systems | My systems | Systems on/off, status, "Request this" for off systems | `tenant_modules`, `module_catalog`, `system_requests` | Cards grid | — | 2 modules on per client (platform, alex_core) | Per-niche system set (profile) + 1 open request |
| /dashboard/settings/business | Business settings | Hours per day, time zone, service area, services, transfer number | `tenants` | Form | — | Hours empty `{}`; service area = city only; services set; transfer number on 9 of 13 | Hours + service-area ZIPs (to confirm) |
| /dashboard/settings/branding | Branding | Logo, primary color, sender name | `tenants.logo_url`, `primary_color`, `email_sender_name` | Form + preview | — | All empty | Logo and brand color from each public site (needs permission) or neutral placeholder |
| /dashboard/settings/team | Team | Members, roles, invites, permissions | `memberships`, `invitations` | Table + invite form | — | 0 members, 0 invites | 1 owner + 1 staff, fictional `@example.test` users |
| /dashboard/settings/alex | Alex settings | Status, call hours, greeting, questions, booking rules, transfer number, request a change | `alex_configs` | Read-mostly form sections | — | 13 rows, provider fake, paused, everything empty | Niche greeting/questions/rules (profile) |
| /dashboard/settings/automations | Automations | 6 templates on/off + recent run history | `automation_templates`, `automations`, `automation_runs` | Toggle cards + run-history table | — | 6 templates defined globally; 0 per-client automations, 0 runs | Enabled templates per niche; ~1.4 runs per lead |
| /dashboard/settings/pipeline | Pipeline stages | Stages with deal counts | `pipeline_stages` | Sortable list | — | 8 generic stages each | Niche stages (remodeling template exists; pools/windows blocked) |
| /dashboard/settings/tags | Tags | Tag list | `tags` | List | — | 0 | hot, financing, insurance-claim, repeat, referral, HOA |
| /dashboard/settings/custom-fields | Custom fields | Field definitions | `custom_field_defs` | Table | — | 0 | Niche fields: roof age / budget range / project timeline / HOA (y/n) / window count |
| /dashboard/settings/notifications | Notification prefs | Email on/off per kind | `notification_preferences` | Toggle list | — | 0 | Defaults for the owner |

Access: client owner and staff of their own tenant only (row-level security on `tenant_id`). Kynetic admin/VA see these pages only through audited view-as. Provider cost, margin and billing are never shown to clients.

### Client pages not built yet (blocked)
| Route | Page | Would show | Blocked by |
|---|---|---|---|
| /dashboard/reviews | Reviews & reputation | requests sent, new reviews, rating trend (line chart) | BLOCKED: n8n vs worker + six systems |
| /dashboard/referrals | Referrals | referrers, referees, status, reward | BLOCKED |
| /dashboard/nurture | Nurture & maintenance | subscribed contacts, next touch | BLOCKED |
| /dashboard/inbox | Two-way texting inbox | threads, assignee, unread | BLOCKED: A2P + wording |
| /dashboard/quotes | Quotes & invoices | quotes, line items, status | BLOCKED: portal vs client tool |
| /dashboard/ads | Ads & cost per lead | spend, leads, CPL (line + KPI) | BLOCKED: prices / only if ads sold |
| /dashboard/usage | Usage & spend cap | minutes, cost, cap | BLOCKED: do clients see cost? |

## Proposed mock data rules (all clients)
- **Fictional people only.** Lead names from a fictional list, phones in the reserved 555-0100–0199 range, emails at `example.test` (same pattern as `seed/demo.ts`). No real homeowner data, no real call audio.
- **Flag every mock row** so it can be removed in one step: `imported_source = 'synthetic_demo'` + `custom.synthetic = true`, or a dedicated import batch per tenant (undo-able via import history).
- **Never touch real outbound.** Mock calls use provider `fake`; nothing dials or texts. `PROVIDER_MODE=stub`, `OUTBOUND_ENABLED=false` stay as they are.
- **Window:** 90 days back from seed date so the 7/30/90 dashboard presets all fill; `go_live_at` = 45 days ago so before/after shows lift; guarantee start = 30 days ago.
- **Funnel (proposed):** reached 66% of leads; booked = niche booking rate × leads; of booked: 70% completed, 10% no-show, 5% cancelled, rest upcoming; won = niche close rate × completed; lost ≈ 18% of leads (reasons: price, went with another contractor, not ready, no response).
- **Call outcomes mix (proposed):** no_answer 30%, voicemail 18%, booked ≈ booking rate, qualified 12%, not_interested 8%, transferred 3%, other remainder; sentiment positive for booked/qualified. Median speed-to-lead 1–3 min on form leads after go-live, 45–240 min before (shows the lift).
- **Lead sources (proposed):** Meta ads 55% (`meta_ads`), website form 20% (`form`, counts toward speed-to-lead), Google ads 15% (`google_ads`), referral 10% (`referral`).
- **Messages:** confirmation + reminder emails; SMS rows shown with status `queued`/`sent` as mock only, since real SMS waits on A2P.
- **Volume scale:** leads per 30 days = 4 × the business's active Meta ads (min 20, max 90). This keeps bigger advertisers busier. Purely an assumption.

## Per-client mock volumes (per 30 days; multiply by 3 for the 90-day seed)
| Client | Leads | Call attempts | Reached | Booked | Booking rate | Completed / no-show / cancelled / upcoming | Won | Won revenue (proposed avg job) | Guarantee baseline → target | Messages | Tasks | Automation runs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Super Roofer LLC | 32 | 61 | 21 | 10 | 32% | 7 / 1 / 0 / 2 | 2 | $29,000 ($14,500) | 8 → 10 | 80 | 19 | 45 |
| DR Roofing & Construction | 60 | 114 | 40 | 19 | 32% | 13 / 2 / 1 / 3 | 4 | $58,000 ($14,500) | 15 → 18 | 150 | 36 | 84 |
| FairClaims Roofing & Construction | 20 | 38 | 13 | 6 | 32% | 4 / 1 / 0 / 1 | 1 | $14,500 ($14,500) | 4 → 5 | 50 | 12 | 28 |
| Fortbend Roofing Texas | 32 | 61 | 21 | 10 | 32% | 7 / 1 / 0 / 2 | 2 | $29,000 ($14,500) | 8 → 10 | 80 | 19 | 45 |
| Rodriguez Roofing | 20 | 38 | 13 | 6 | 32% | 4 / 1 / 0 / 1 | 1 | $14,500 ($14,500) | 4 → 5 | 50 | 12 | 28 |
| BlueWater Pools, LLC | 32 | 61 | 21 | 6 | 20% | 4 / 1 / 0 / 1 | 1 | $82,000 ($82,000) | 4 → 5 | 80 | 19 | 45 |
| Tidal Wave Custom Pools | 28 | 53 | 18 | 6 | 20% | 4 / 1 / 0 / 1 | 1 | $82,000 ($82,000) | 4 → 5 | 70 | 17 | 39 |
| Kelley Pools and Outdoor | 20 | 38 | 13 | 4 | 20% | 3 / 1 / 0 / 0 | 1 | $82,000 ($82,000) | 3 → 4 | 50 | 12 | 28 |
| Clarity Windows And Doors | 88 | 167 | 58 | 26 | 30% | 18 / 3 / 1 / 4 | 5 | $80,000 ($16,000) | 20 → 24 | 220 | 53 | 123 |
| Bridgewood Windows & Doors | 20 | 38 | 13 | 6 | 30% | 4 / 1 / 0 / 1 | 1 | $16,000 ($16,000) | 4 → 5 | 50 | 12 | 28 |
| Kitchens Alive LLC | 40 | 76 | 26 | 10 | 26% | 7 / 1 / 0 / 2 | 2 | $76,000 ($38,000) | 8 → 10 | 100 | 24 | 56 |
| Manta Construction Company | 32 | 61 | 21 | 8 | 26% | 6 / 1 / 0 / 1 | 2 | $76,000 ($38,000) | 6 → 8 | 80 | 19 | 45 |
| 123 Remodeling | 48 | 91 | 32 | 12 | 26% | 8 / 1 / 1 / 2 | 2 | $76,000 ($38,000) | 9 → 11 | 120 | 29 | 67 |

Each client also has its own profile note: **"PORTAL DEMO CLIENT NN: <name> — data profile"**.

