<cursor_untrusted_data_1337 source="ReadCanvas">

Canvas "Kynetic Client CRM & Portal: Full Spec" (https://cursor.com/canvas/store-aedc3439-bcce-49cc-b11f-5e32c7fc8ae4/17f497c2-b8b7-4c78-af28-739a2ebf550d):

import { Page, Section, Text, Table, TableOfContents, Callout, Rows, Properties, NumberedList, Steps, Diagram, Segmented, useState } from "grok/canvas";

type P = "Must" | "Later" | "Skip";
type F = [string, string, P];

const pc = (p: P) => (p === "Must" ? { text: "Must (v1)", tone: "success" as const } : p === "Later" ? { text: "Later" } : { text: "Skip", tone: "danger" as const });

const client: F[] = [
  ["Results dashboard", "Stat cards up top: leads received, speed-to-lead, calls made, contact rate, estimates booked, booking rate, revenue recovered; each vs the client's starting baseline captured at signup; trend chips; date-range picker", "Must"],
  ["Results dashboard", "Line chart of booked estimates over time; bar chart of outcomes by lead source; recent activity feed", "Must"],
  ["Results dashboard", "Guarantee tracker (progress to the agreed 60-day booking target)", "Must"],
  ["Results dashboard", "Custom tabs per client (e.g. voice clients: calls answered, cost, bookings), toggled by admin", "Later"],
  ["Contacts", "List with TanStack table: search, filters (status, source, tag, owner, date), sort, column show/hide, paging, URL-saved views", "Must"],
  ["Contacts", "Contact page: details, phones/emails, address, source, tags, consent status, linked company and deals, timeline, tasks, notes", "Must"],
  ["Contacts", "Create/edit in slide-out panel; duplicate detection on phone and email; merge duplicates", "Must"],
  ["Contacts", "Bulk actions: tag, assign owner, change status, delete, enroll in sequence", "Must"],
  ["Contacts", "Saved views shared across the team", "Later"],
  ["Companies", "Company list and page (commercial customers, property managers); contacts and deals rolled up", "Must"],
  ["Companies", "Company logo/enrichment", "Later"],
  ["Custom fields", "Per-tenant fields on contacts, companies and deals: text, number, money, date, select, multi-select, checkbox; show in tables, filters, import", "Must"],
  ["Custom fields", "Conditional and computed fields", "Skip"],
  ["Deals", "Deal with value, stage, service type, expected close, owner, lead source, lost reason", "Must"],
  ["Deals", "Multiple contacts per deal with a role (homeowner, spouse, tenant, property manager)", "Must"],
  ["Deals", "Kanban board (dnd-kit): drag between stages, column count and dollar total, optimistic move with undo toast, filter by owner/source", "Must"],
  ["Deals", "Configurable pipelines and stages per tenant (default: New, Contacted, Qualified, Estimate Booked, Estimate Done, Quoted, Won, Lost)", "Must"],
  ["Deals", "Multiple pipelines per tenant", "Later"],
  ["Activity timeline", "Unified per contact and deal: calls, SMS, emails, stage changes, notes, tasks, appointments, automation events; filter by type", "Must"],
  ["Tasks and follow-ups", "Task with title, due date and time, assignee, linked contact/deal, priority; My Tasks view (overdue, today, upcoming); reminders via notification", "Must"],
  ["Tasks and follow-ups", "Recurring tasks", "Later"],
  ["Notes", "Rich-text notes on contacts, companies, deals; @mention teammates; pin a note", "Must"],
  ["Notes", "File attachments on notes (photos of job site)", "Later"],
  ["Appointments calendar", "Month/week/day views of estimates booked by Alex or staff; create, reschedule, cancel; status (scheduled, completed, no-show)", "Must"],
  ["Appointments calendar", "Google Calendar two-way sync per staff member", "Later"],
  ["Alex call logs", "Call list: time, contact, direction, duration, outcome chip (booked, qualified, not interested, voicemail, no answer, transferred, DNC), sentiment", "Must"],
  ["Alex call logs", "Call detail: recording player, full transcript, AI summary, extracted fields, next step; linked to timeline", "Must"],
  ["Alex call logs", "Flag a call for Kynetic review (feedback loop)", "Must"],
  ["Alex call logs", "Per-call cost shown to client", "Later"],
  ["SMS and email logs", "Every message Alex or automations send/receive, with delivery status, on the timeline and in a log view", "Must"],
  ["Automations", "Prebuilt templates toggled per client: speed-to-lead, old-lead reactivation, quote follow-up, appointment reminders, no-show recovery, missed-call text-back", "Must"],
  ["Automations", "Sequences (multi-step SMS/email/call with delays, stop on reply or booking)", "Must"],
  ["Automations", "Stage moves (e.g. booked call -> Estimate Booked) and alerts (deal won email, hot lead SMS to owner)", "Must"],
  ["Automations", "Visual workflow builder for clients", "Skip"],
  ["Notifications", "Bell with unread count, popover, full page with tabs; in-app + email; types: new lead, booked, task due, report ready, action needed", "Must"],
  ["Notifications", "Per-user notification preferences; SMS/push to owner", "Later"],
  ["Search and Cmd+K", "Global search across contacts, companies, deals; Cmd+K (kbar) to jump to records and pages, quick create", "Must"],
  ["CSV import/export", "Import contacts/companies/deals with column mapping, preview, dedupe; export any table view", "Must"],
  ["Per-client branding", "Logo, primary color, business name in portal; branded email sender name", "Must"],
  ["Per-client branding", "Custom domain per client (crm.clientname.com)", "Later"],
  ["Settings", "Business profile, business hours, service area (zips/radius), services offered, transfer number, team members and roles", "Must"],
  ["Settings", "Alex settings visible to client: greeting, call hours, qualification questions, booking rules, pause Alex (edits by request or limited fields)", "Must"],
  ["Settings", "Pipelines, stages, custom fields, tags, notification preferences", "Must"],
  ["Mobile", "Responsive everywhere; mobile-first for contact page, calls, tasks, calendar; tap-to-call/text", "Must"],
  ["Mobile", "Installable PWA", "Later"],
  ["Booking page", "Public page per client for customers to self-book estimates against availability", "Later"],
  ["Two-way texting inbox", "Shared inbox, reply as business, assign, templates, take over from Alex (after A2P approval)", "Later"],
  ["Reviews", "Review requests after job won, track ratings, route unhappy to private feedback (reviews add-on)", "Later"],
  ["Reports", "Prebuilt monthly ROI report (PDF/email) vs baseline", "Must"],
  ["Reports", "Custom report builder", "Later"],
  ["Quotes and invoices", "Quote builder, e-sign, invoices, payments", "Later"],
  ["Chat / AI chat demo pages", "From starter; fake replies", "Skip"],
];

const admin: F[] = [
  ["All clients", "Table: client, plan (founding/value), MRR, go-live date, leads 30d, booking rate, guarantee status, health score chip, last login", "Must"],
  ["Health score", "0-100 from: booking rate vs target, lead volume trend, integration errors, login recency, open issues; green/yellow/red", "Must"],
  ["Client onboarding (~30s)", "One form: business name, owner email, phone, industry template, hours, service area, logo/color, plan; creates tenant, owner invite, default pipeline, automations, Alex config draft", "Must"],
  ["Client onboarding", "Provision Twilio number and Retell/ElevenLabs agent automatically", "Later"],
  ["View as client", "Impersonate a tenant read-only by default, banner shown, every session logged", "Must"],
  ["Per-client Alex config", "Provider, agent ID, voice, script/prompt version, qualification questions, booking rules, call windows, retry cadence, transfer number, test call button", "Must"],
  ["Per-client Alex config", "Prompt versioning with diff and rollback", "Later"],
  ["Audit log", "Who did what, when, from where, before/after values; filter by tenant/user/action", "Must"],
  ["User management", "Invite, deactivate, reset, change roles across all tenants; Kynetic admin/VA accounts", "Must"],
  ["Integration health", "Per client and global: Retell/ElevenLabs, Twilio (A2P status, delivery failures), n8n workflow runs, Resend bounces; last success, error count, alerts", "Must"],
  ["Backups", "Status of nightly offsite backup, last restore test, manual backup button", "Must"],
  ["Usage and cost", "Minutes, SMS, emails per client; cost vs revenue margin", "Later"],
  ["Phase 2: Kynetic pipeline", "Kynetic's own prospects and deals (replaces Twenty)", "Later"],
  ["Phase 2: Billing and MRR", "Setup fees, monthly fees, invoices, MRR and churn chart", "Later"],
  ["Phase 2: $100K goal tracker", "Progress to the revenue goal by month", "Later"],
  ["Phase 2: Email templates", "The 9 outreach templates with founding/variable pricing; email sync", "Later"],
  ["Phase 2: Audit tool link", "Hidden /audit results saved to prospect records", "Later"],
];

const tables: [string, string][] = [
  ["tenants", "id, name, slug, plan (founding|value), status, logo_url, primary_color, timezone, business_hours jsonb, service_area jsonb, transfer_number, baseline jsonb, created_at"],
  ["users", "id, email, name, image, kynetic_role (admin|va|null), two_factor_enabled (later)"],
  ["memberships", "user_id, tenant_id, role (owner|staff)"],
  ["sessions / accounts / verification", "Auth library tables (Better-Auth)"],
  ["contacts", "id, tenant_id, first/last name, phones[], emails[], address, company_id, source, status, tags[], owner_id, custom jsonb, consent fields, created_at"],
  ["companies", "id, tenant_id, name, phone, website, address, custom jsonb"],
  ["custom_field_defs", "id, tenant_id, entity, key, label, type, options jsonb, position"],
  ["pipelines / stages", "pipeline: id, tenant_id, name; stage: id, pipeline_id, name, position, probability, is_won, is_lost"],
  ["deals", "id, tenant_id, pipeline_id, stage_id, title, value_cents, service_type, expected_close, owner_id, source, lost_reason, position, custom jsonb"],
  ["deal_contacts", "deal_id, contact_id, role"],
  ["activities", "id, tenant_id, contact_id, deal_id, type, ref_table, ref_id, summary, actor (user|alex|automation), occurred_at"],
  ["tasks", "id, tenant_id, title, due_at, assignee_id, contact_id, deal_id, priority, completed_at"],
  ["notes", "id, tenant_id, body, author_id, contact_id, company_id, deal_id, pinned"],
  ["appointments", "id, tenant_id, contact_id, deal_id, starts_at, ends_at, address, status, booked_by, external_event_id"],
  ["calls", "id, tenant_id, contact_id, provider, provider_call_id, direction, started_at, duration_s, outcome, sentiment, recording_url, transcript, summary, extracted jsonb, cost_cents, flagged"],
  ["messages", "id, tenant_id, contact_id, channel (sms|email), direction, body, subject, provider_id, status, error, sent_at"],
  ["consents", "id, tenant_id, contact_id, channel, type (express_written|opt_out), source, captured_text, ip, captured_at, revoked_at"],
  ["automations / automation_runs", "automation: id, tenant_id, template_key, enabled, config jsonb; run: id, automation_id, contact_id, step, status, next_run_at"],
  ["alex_configs", "tenant_id, provider, agent_id, voice, prompt_version, questions jsonb, booking_rules jsonb, call_windows jsonb, retry jsonb"],
  ["notifications", "id, tenant_id, user_id, type, title, link, read_at"],
  ["integrations", "id, tenant_id, kind, status, last_success_at, last_error, error_count"],
  ["webhook_events", "id, source, external_id (unique), payload jsonb, processed_at, error"],
  ["imports", "id, tenant_id, entity, file_name, mapping jsonb, rows_ok, rows_failed, status"],
  ["audit_log", "id, tenant_id, user_id, impersonator_id, action, entity, entity_id, before jsonb, after jsonb, ip, at"],
  ["metrics_daily", "tenant_id, date, leads, calls, contacts_reached, booked, revenue_cents (rollup for dashboards)"],
];

const integ: [string, string, string][] = [
  ["Lead sources (forms, Angi, Google LSA, Facebook)", "Inbound webhook per tenant `/api/hooks/leads/:tenantKey` (signed token) -> create contact + deal -> trigger Alex", "In"],
  ["Retell / ElevenLabs", "Start outbound call via API; webhook on call end: outcome, transcript, recording, extracted fields; booking tool call hits our availability + create appointment API", "Both"],
  ["Twilio", "SMS send; status callbacks; inbound SMS webhook; STOP/HELP handling writes consent; phone numbers; A2P campaign status", "Both"],
  ["n8n", "Runs sequences and longer workflows; calls our API with service token; we emit events (lead.created, deal.stage_changed, call.completed) to n8n", "Both"],
  ["Resend", "Transactional + automation email from branded sender; webhooks for delivered, bounced, complained", "Both"],
  ["Google", "Sign-in (OAuth); Calendar sync later", "Both"],
  ["Twenty (Kynetic only)", "Optional push of tenant summary (MRR, status) to Kynetic's Twenty; no client data", "Out"],
];

const milestones: [string, string, string, string][] = [
  ["M0 Foundation (one thread, first)", "Repo from starter, strip Clerk/demos, Drizzle + Postgres schema core, Better-Auth + Google, tenants/memberships, RLS policies, role guards, shell and theme, audit log helper, CI (lint, typecheck, Vitest, Playwright), Docker, preview env", "None", "Tenant A user cannot read tenant B rows via API or SQL; login works; CI green; preview deploys"],
  ["M1 Contacts + companies + custom fields", "Lists, pages, forms, dedupe, bulk actions, custom field defs", "M0", "CRUD e2e; custom field filters; dedupe catches same phone"],
  ["M2 Deals + kanban", "Deals, multi-contact, pipelines/stages, board with totals, optimistic drag", "M1", "Drag persists; totals correct; rollback on failure"],
  ["M3 Activity, notes, tasks", "Unified timeline, notes with mentions, tasks with due time, My Tasks, reminders", "M1, M2", "Every write creates an activity; overdue task notifies"],
  ["M4 Calls + messages (Alex)", "Lead webhook, Retell/ElevenLabs + Twilio + Resend adapters, call logs, transcripts, recordings, consent capture, idempotent webhooks", "M1", "Replayed webhook is no-op; test call lands on timeline; STOP revokes consent"],
  ["M5 Appointments calendar", "Calendar views, availability, booking API for Alex", "M1, M4 API", "Alex booking tool creates appointment within business hours only"],
  ["M6 Dashboard + reports", "metrics_daily rollup, stat cards vs baseline, charts, monthly ROI email", "M2, M4, M5", "Numbers match seeded fixture data"],
  ["M7 Automations + notifications", "Template automations, sequences, stage moves, alerts, bell", "M2, M3, M4", "Sequence stops on reply; won deal alert sent"],
  ["M8 Admin side", "All clients, health score, 30s onboarding, view-as, Alex config, integration health, user mgmt, backups page", "M0 (data from M4, M6)", "Onboarding under 30s creates working tenant; impersonation logged"],
  ["M9 Search, Cmd+K, import/export, branding, settings, mobile polish", "Global search, kbar, CSV, branding, settings pages", "M1, M2", "Import 1,000 rows with mapping; branding applies everywhere"],
  ["M10 Hardening + launch", "Security review, load test, backup restore drill, migrate existing portal users", "All", "Restore drill passes; pilot client live"],
];

const notBuilding = [
  "Clerk auth and Clerk billing, self-serve plans, pricing pages",
  "Starter chat and AI chat demo pages, sample Users/Products pages",
  "Visual drag-and-drop automation builder for clients",
  "Client-facing custom report builder (v1)",
  "Quotes, invoices, payments (v1)",
  "Two-way SMS inbox (until A2P approval and v1 ships)",
  "Native iOS/Android apps",
  "Email inbox sync / Gmail sending",
  "Marketplace, public API for clients, Zapier app",
  "Multi-language UI",
  "Any client data in Twenty; any AGPL code (Twenty, EspoCRM, SuiteCRM, etc.)",
  "Timers/polling sync; data arrives by webhook or user action",
];

const questions = [
  "Portal domain: portal.kyneticai.com for everyone, or per-client subdomains later?",
  "Primary voice provider: Retell or ElevenLabs (other as fallback)?",
  "Do clients see per-call costs, or only results?",
  "Branding fields: logo, color and name only, or also custom domain and email sender?",
  "Data retention: how long to keep recordings and transcripts (e.g. 12 months), and what happens to data when a client leaves?",
  "Existing portal users: who are they, and do we migrate accounts and data or start fresh?",
  "Which Alex settings can a client change themselves vs request from Kynetic?",
  "Health score weights and the guarantee target per client",
];

function featureTable(rows: F[], filter: string) {
  const r = rows.filter((x) => filter === "All" || x[2] === filter);
  return <Table columns={["Feature", "Sub-features", "Priority"]} rows={r.map((x) => [x[0], x[1], pc(x[2])])} />;
}

export default function App() {
  const [cf, setCf] = useState<string>("All");
  const [af, setAf] = useState<string>("All");
  const opts = ["All", "Must", "Later", "Skip"];
  return (
    <Page title="Kynetic Client CRM & Portal: Full Spec" summary="Everything the custom client CRM, portal and Kynetic admin side will do, how it is built and hosted, and the order the Project builds it in." width="wide">
      <TableOfContents items={[
        { label: "1. Vision and goals", id: "vision" },
        { label: "2. Users and roles", id: "roles" },
        { label: "3. Client-side features", id: "client" },
        { label: "4. Admin-side features", id: "admin" },
        { label: "5. Data model", id: "data" },
        { label: "6. Integrations and webhooks", id: "integ" },
        { label: "7. Architecture and hosting", id: "arch" },
        { label: "8. Security and compliance", id: "sec" },
        { label: "9. Design system rules", id: "design" },
        { label: "10. Build plan", id: "build" },
        { label: "11. Not building", id: "not" },
        { label: "12. Open questions", id: "q" },
      ]} />

      <Section heading="1. Vision and goals" id="vision">
        <Text>A Kynetic-owned CRM and client portal sold to home-service businesses. Alex, the AI outbound agent, calls every new lead within seconds, qualifies them and books estimates, and every result lands in the client's own CRM. The client sees exactly what Alex did and what it earned against their starting numbers. Kynetic runs every client from one admin side.</Text>
        <Properties items={[
          { label: "Primary goal", value: "Prove ROI: booked estimates and revenue recovered vs baseline, visible on day one" },
          { label: "Product goal", value: "A CRM good enough that clients drop their old one; branded as theirs" },
          { label: "Ops goal", value: "Onboard a client in about 30 seconds; run all clients from one admin view" },
          { label: "Business goal", value: "Support founding clients ($6,500 for setup + 3 months, then $1,500/mo) and value-priced clients from /audit; sell add-ons inside the portal" },
          { label: "Phase 2", value: "Same codebase replaces Twenty for Kynetic's own pipeline and billing" },
          { label: "Success for v1", value: "First founding client live, using the portal daily, with Alex bookings and a monthly ROI report" },
        ]} />
      </Section>

      <Section heading="2. Users and roles" id="roles">
        <Table columns={["Role", "Who", "Can do", "Cannot do"]} rows={[
          ["Kynetic admin", "Abdullah", "Everything: all tenants, onboarding, Alex config, billing, view-as, user mgmt, audit log", "Nothing restricted"],
          ["Kynetic VA", "Support staff", "View all tenants, view-as (read-only), edit contacts/tasks on request, check integration health", "Billing, delete tenants, change Alex prompts, manage admins"],
          ["Client owner", "Business owner", "Everything in their tenant: data, team, settings, branding, permitted Alex settings, exports", "Other tenants, admin side, raw Alex prompt"],
          ["Client staff", "Office manager, sales rep", "Work leads, deals, tasks, notes, calendar, view calls", "Team/settings/branding, exports and bulk delete (owner-toggleable)"],
        ]} />
      </Section>

      <Section heading="3. Client-side features" id="client" actions={<Segmented options={opts} value={cf} onChange={setCf} />}>
        {featureTable(client, cf)}
      </Section>

      <Section heading="4. Admin-side features" id="admin" actions={<Segmented options={opts} value={af} onChange={setAf} />}>
        {featureTable(admin, af)}
      </Section>

      <Section heading="5. Data model" id="data" caption="Postgres; every tenant table carries tenant_id with row-level security. Data model adapted from Atomic CRM.">
        <Table columns={["Table", "Key fields"]} rows={tables.map((t) => [t[0], t[1]])} />
      </Section>

      <Section heading="6. Integrations and webhooks" id="integ">
        <Table columns={["Service", "How it connects", "Direction"]} rows={integ.map((i) => [i[0], i[1], i[2]])} />
        <Text>Every inbound webhook is signature-verified, stored in `webhook_events` with a unique external id (idempotent), processed by a job queue, and retried on failure. Failures surface in integration health.</Text>
      </Section>

      <Section heading="7. Architecture and hosting" id="arch">
        <Diagram direction="horizontal" nodes={[
          { id: "u", label: "Users", kind: "person" },
          { id: "cf", label: "Cloudflare", detail: "DNS, TLS, WAF, cache" },
          { id: "app", label: "Next.js app", detail: "Docker on Abdullah's server" },
          { id: "w", label: "Worker", detail: "jobs, webhooks (pg-boss)" },
          { id: "db", label: "Postgres", detail: "RLS per tenant" },
          { id: "bk", label: "Offsite backups", detail: "nightly, R2/B2" },
          { id: "ext", label: "Retell/ElevenLabs, Twilio, n8n, Resend" },
        ]} edges={[
          { from: "u", to: "cf" }, { from: "cf", to: "app" }, { from: "app", to: "db" }, { from: "w", to: "db" },
          { from: "ext", to: "cf", label: "webhooks" }, { from: "app", to: "ext" }, { from: "db", to: "bk", dashed: true },
        ]} />
        <Properties items={[
          { label: "Stack", value: "Next.js 16, React 19, Tailwind 4, shadcn/ui, TanStack Table/Query/Form, Zod, Recharts, dnd-kit, kbar, Drizzle ORM, Better-Auth (Google + email magic link)" },
          { label: "Runtime", value: "Docker Compose: app, worker, Postgres, Caddy or Cloudflare Tunnel; no ports exposed except through Cloudflare" },
          { label: "Database", value: "Postgres 16; app connects as a non-owner role so RLS always applies; migrations via Drizzle in CI" },
          { label: "Files", value: "Recordings stay at provider or copied to S3-compatible storage (R2) with signed URLs" },
          { label: "Backups", value: "Nightly pg_dump encrypted to offsite storage, 30 daily + 12 monthly kept; monthly restore drill" },
          { label: "Environments", value: "Preview per branch/PR (separate DB with seed data) and production; secrets per env; no real client data in preview" },
          { label: "Observability", value: "Structured logs, uptime check, Sentry optional" },
        ]} />
      </Section>

      <Section heading="8. Security and compliance" id="sec">
        <Table columns={["Area", "Requirement", "Priority"]} rows={[
          ["Tenant isolation", "RLS on every tenant table using a session `app.tenant_id`; tests prove cross-tenant reads fail", pc("Must")],
          ["Roles and permissions", "Server-side checks on every action; UI hides what a role cannot do", pc("Must")],
          ["TCPA consent", "Store consent source, wording, timestamp, IP per contact and channel; block calls/SMS without consent; honor STOP and DNC instantly; quiet hours by contact timezone", pc("Must")],
          ["Recording disclosure", "Alex states the call is recorded at the start; disclosure text stored per tenant; two-party-consent states flagged", pc("Must")],
          ["Audit log", "All writes, logins, exports, impersonation; append-only", pc("Must")],
          ["Secrets", "Provider keys encrypted at rest, never sent to the browser", pc("Must")],
          ["Rate limits", "Login, webhooks, API", pc("Must")],
          ["2FA", "TOTP for Kynetic staff first, then client owners", pc("Later")],
          ["Data export/deletion", "Full tenant export and delete on offboarding", pc("Later")],
        ]} />
      </Section>

      <Section heading="9. Design system rules" id="design">
        <NumberedList items={[
          "One job per dashboard; the most important numbers sit at the top.",
          "Status and category are colored chips; color comes from the data (red = overdue or failed, green = booked or won).",
          "Numbers right-aligned in tables, tabular figures, currency formatted.",
          "Progressive disclosure: rare actions in menus or on row hover; tooltips on every metric and icon.",
          "Every list has a helpful empty state with the next action.",
          "Toasts confirm every action, with undo where possible; optimistic UI on drag, edits and task completion.",
          "Charts stay simple: line or bar with a date-range picker.",
          "Client branding swaps logo and primary color only; layout and type stay Kynetic's.",
          "Mobile-first for daily-use pages; touch targets 44px.",
        ]} />
      </Section>

      <Section heading="10. Build plan" id="build">
        <Text>The Project runs M0 alone, then the rest as parallel threads. Each thread works from this spec, ships behind tests, and merges to main as soon as CI passes. No big-bang merge.</Text>
        <Table columns={["Milestone", "Scope", "Depends on", "Acceptance tests"]} rows={milestones.map((m) => [m[0], m[1], m[2], m[3]])} />
        <Steps steps={[
          { title: "Wave 1", detail: "M0 Foundation, merged and deployed to preview" },
          { title: "Wave 2 (parallel)", detail: "M1 contacts, M4 calls/messages adapters, M8 admin shell" },
          { title: "Wave 3 (parallel)", detail: "M2 deals/kanban, M3 activity/tasks, M5 calendar, M9 search/import/branding" },
          { title: "Wave 4", detail: "M6 dashboard/reports, M7 automations/notifications, M8 completes" },
          { title: "Wave 5", detail: "M10 hardening, pilot with first founding client" },
        ]} />
      </Section>

      <Section heading="11. Not building" id="not">
        <Rows rows={notBuilding.map((n) => ({ title: n }))} />
      </Section>

      <Section heading="12. Open questions for Abdullah" id="q">
        <NumberedList items={questions} />
        <Callout tone="info">Answers to these slot into the brief before M0 starts; everything else above is decided.</Callout>
      </Section>
    </Page>
  );
}


</cursor_untrusted_data_1337>