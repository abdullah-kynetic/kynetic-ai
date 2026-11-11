# Lane B Spec 02 gap audit

Audited 2026-11-11 against Twenty note `d7daa4c4-f466-4ca1-b56f-728b61c14590` and `main` at `59a25237`. “Partial” means the route and core data exist but at least one formula, display, filter, or role rule in that Spec 02 row is absent. Blocked commercial values must remain labelled “to be confirmed.”

| Spec 02 row | Status | Evidence and remaining gap |
| --- | --- | --- |
| All clients — client link | done | `crm/src/app/admin/page.tsx:38` renders the tenant table and `:59` links each name to its overview. |
| All clients — plan + tier | done | `crm/src/app/admin/page.tsx:66` displays both values from `listAdminTenantOverview`. |
| All clients — leads 30d | done | `crm/src/server/admin/overview.ts:48` reads `admin_tenant_overview()` and maps `leads_30d` at `:71`; the page labels the fixed range at `crm/src/app/admin/page.tsx:43`. |
| All clients — bookings 30d | done | `crm/src/server/admin/overview.ts:73` maps the rollup value and `crm/src/app/admin/page.tsx:44` displays it. |
| All clients — MRR inputs | done | `crm/src/app/admin/page.tsx:71` shows the system count and the admin-only blocked value as “$ to be confirmed”; VA sees no commercial value. |
| All clients — health score | done | The five-part formula and 70/40 thresholds are in `crm/src/server/admin/overview.ts:27` and the status chip is at `crm/src/app/admin/page.tsx:72`. |
| Client overview — profile | done | Status, owner, phone, timezone, hours, services and ZIPs render in `crm/src/app/admin/clients/[tenantId]/page.tsx:61`. |
| Client overview — systems | done | Enabled modules and CRM level render at `crm/src/app/admin/clients/[tenantId]/page.tsx:129`. |
| Client overview — pipeline snapshot | done | Tenant-scoped count/value aggregation is in `crm/src/server/admin/client-overview.ts:136`; the horizontal Recharts funnel and text fallback are in `crm/src/app/admin/clients/[tenantId]/pipeline-funnel.tsx:1`. |
| Client overview — guarantee | done | Formula and admin edit/VA read-only behavior remain at `crm/src/app/admin/clients/[tenantId]/page.tsx:33`; the labelled progress bar and percentage are in the booking-guarantee card. |
| Client overview — spend cap | done | Admin-only cap form is at `crm/src/app/admin/clients/[tenantId]/page.tsx:165`; VA does not see it. |
| Client overview — recent activity | done | Latest activity feed with empty state is at `crm/src/app/admin/clients/[tenantId]/page.tsx:196`. |
| Onboard a client | done | Multi-section tenant/template/module form is in `crm/src/app/admin/clients/new/onboarding-form.tsx:1`; server validation and creation are in `crm/src/server/admin/onboarding.ts:1`. |
| Per-client systems | done | Module/CRM controls and history are in `crm/src/app/admin/clients/[tenantId]/systems/page.tsx:1` and `systems-panel.tsx:1`. |
| Client Alex config | done | Admin-only provider/config form and prompt versions are in `crm/src/app/admin/clients/[tenantId]/alex/page.tsx:1`; access is enforced by `crm/src/server/admin/alex-config.ts:1`. |
| Client billing profile | done | Admin-only profile, module snapshots and totals are in `crm/src/app/admin/clients/[tenantId]/billing/billing-panel.tsx:1`; unset prices remain empty rather than inferred. |
| Setup checklist | done | `crm/src/app/admin/clients/[tenantId]/checklist/page.tsx:30` computes done ÷ (all − n/a); `crm/src/server/admin/checklist.ts:200` adds an admin-only, audited, additive regeneration from enabled-system templates. |
| Client documents | done | Kind-filterable list and upload/replace controls are in `crm/src/app/admin/clients/[tenantId]/documents/page.tsx:1` and `document-list.tsx:1`. |
| Imports | done | Wizard, dry-run/history and undo UI are in `crm/src/app/admin/clients/[tenantId]/imports/panel.tsx:1`. |
| Online presence admin | done | Presence task and review snapshot forms are in `crm/src/app/admin/clients/[tenantId]/presence/page.tsx:1`. |
| Reports admin | done | Month scheduling and report status list are in `crm/src/app/admin/clients/[tenantId]/reports/page.tsx:1`. |
| Webhooks and service tokens | done | Intake/n8n settings and token lifecycle are in `crm/src/app/admin/clients/[tenantId]/webhooks/page.tsx:1` and `service-tokens/page.tsx:1`. |
| Offboarding | done | Export state and manual deletion date are in `crm/src/app/admin/clients/[tenantId]/offboard/page.tsx:1`. |
| System requests | done | Admin/VA table is in `crm/src/app/admin/system-requests/page.tsx:1`. |
| Template library | done | Industry and system template cards/apply controls are in `crm/src/app/admin/templates/page.tsx:26`; pool/windows defaults are in `crm/src/server/admin/industry-templates.ts:32`. |
| Usage and margin | partial | Month picker, table and CSV exist at `crm/src/app/admin/usage/page.tsx:18` and `:52`; cost-vs-fee stacked chart and explicit 80% visual are absent. |
| Operations | done | Pause, alerts, integrations, jobs, webhooks and flagged-call sections are in `crm/src/app/admin/operations/page.tsx:44`; access is staff-gated. |
| Users | done | Search/client filters are wired at `crm/src/app/admin/users/page.tsx:38` and the required columns/actions start at `:86`. |
| Audit | done | Client/actor/action/date filters start at `crm/src/app/admin/audit/page.tsx:128`; expandable before/after detail is at `:66`. |
| Backups | done | Backup and restore-drill table/actions are in `crm/src/app/admin/backups/page.tsx:1`. |
| View as | done | Client/reason/window form is in `crm/src/app/admin/view-as/start-form.tsx:1`; guard logic is in `view-as-guard.ts:1`. |
| Support | done | Queue remains open-first and now preserves independent category and status filters at `crm/src/app/admin/support/page.tsx:38`; service validation is in `crm/src/server/support/service.ts:301`. |
| Agency home — monthly finance | done | Pacific-month revenue, expense and net cards are at `crm/src/app/admin/agency/page.tsx:82`. |
| Agency home — pick/reply rates | partial | Seven-day formulas/cards are at `crm/src/app/admin/agency/page.tsx:102`; the proposed 30-day line display is absent. |
| Agency home — sources and lead table | partial | Source counts and direction/channel filters are at `crm/src/app/admin/agency/page.tsx:135`; the required source/stage filters and visible state/lost reason are incomplete. |
| Agency home — alerts | done | Alert list and empty state are at `crm/src/app/admin/agency/page.tsx:237`. |
| Human dialer | done | Campaign filter, script, outcome controls and callbacks are in `crm/src/app/admin/agency/dialer/page.tsx:17`; policy enforcement is in `crm/src/server/agency/dialer-policy.ts:1`. |
| Campaigns | done | Campaign setup, enrollment, due work and results are in `crm/src/app/admin/agency/campaigns/page.tsx:18` and `sequence.tsx:1`. |
| Inbox / compose | done | Channel/direction/status filtering and draft-only compose are in `crm/src/app/admin/agency/inbox/page.tsx:13` and `compose/page.tsx:12`. |
| Proposals | done | Deal selection, editor, revision and PDF preview are in `crm/src/app/admin/agency/proposals/page.tsx:17` and `[proposalId]/editor.tsx:1`; prices are copy-only “to be confirmed.” |
| Contracts | done | Status/stage filters, manual lifecycle and file tracking are in `crm/src/app/admin/agency/contracts/page.tsx:20`. |
| Agency billing | done | Deal terms, invoice ledger and stub-only dunning UI are in `crm/src/app/admin/agency/billing/page.tsx:21`; no charge path exists. |
| Finance | partial | Monthly table, CSV and asset forms are at `crm/src/app/admin/agency/finance/page.tsx:67`; the specified revenue-vs-expense bar chart is absent. |
| Agency ops | done | Daily preview, health list and DEV workflow/secret cards are in `crm/src/app/admin/agency/ops/page.tsx:15`. |

## Fix batches

1. All-clients MRR blocked label; client pipeline value/funnel; guarantee progress; checklist formula/regeneration; support status filter.
2. Usage cost-vs-fee chart and cap visualization; agency 30-day rate line; agency source/stage lead filters and fields; finance monthly bar chart.
3. Re-audit every row after batches 1–2 and leave only explicitly parked business decisions.
