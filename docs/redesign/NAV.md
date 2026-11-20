# Portal navigation map

Both portal shells show business areas in the sidebar. Each area owns one main page and a shared horizontal, mobile-scrollable tab bar for its sub-pages. The active tab follows the URL. Legacy URLs return HTTP 301 to their new homes.

| Admin area | Main page | Tabs |
| --- | --- | --- |
| Today | `/admin` | — |
| Clients | `/admin/clients` | Board (lifecycle Kanban), Live, Demo, Churned, Operations (filterable tables) |
| Prospecting | `/admin/prospecting` | Funnel (dashboard), Scraped leads, Half-enriched, Fully enriched, Campaigns, Human dialer |
| Sales | `/admin/sales` | Pipeline, Inbox, Compose, Free audits, Proposals, Contracts |
| Money | `/admin/money` | Overview (revenue dashboard), Finance, Billing, Invoices, Usage |
| Settings | `/admin/settings` | Account, Team, Integrations, Build, System |

VAs see Today, Clients, Settings, and Help in the admin shell. VA Help has Support and System requests tabs at `/admin/help`. Admin-only areas remain guarded on the server. Proposal detail and preview live below Sales; archive and audit live below Settings → System.

| Client area | Main page | Tabs |
| --- | --- | --- |
| Dashboard | `/dashboard` | — |
| Leads | `/dashboard/leads` | Overview, Contacts, Pipeline, Import, Companies, Tasks |
| Calls & Bookings | `/dashboard/bookings` | Overview, Calls, Appointments, Messages |
| Reputation | `/dashboard/reputation` | Overview, Reviews, Referrals, Online presence |
| Settings | `/dashboard/settings` | Account, Team, Branding, Pipeline, Tags, Notifications, Automations, Custom fields, Alex, My systems |
| Help | `/dashboard/help` | Support, Documents, Reports, Usage, Notifications |

Client detail URLs stay below the owning area: contact, company, and deal details under Leads; call details under Calls & Bookings; support and report details under Help. Existing permissions and module checks still apply to destination pages.

## Area main pages (Phase 3)

- **Clients board** moves a client between Onboarding, Live, At risk, Churned and Demo. Each move is saved to `client_lifecycle` (migration 1092) and appends an `audit_log` row. Admin only; VAs see the board read-only. Kynetic Restoration (Demo) is locked.
- **Prospecting funnel** counts prospects per enrichment stage with step conversion and source breakdown. Scraped, Half-enriched and Fully enriched are searchable, filterable tables with bulk select and **Move to Sales**, which creates a deal only (no message, call or provider request). Data is `agency_prospects` (migration 1093).
- **Money overview** shows MRR (monthly fee on won deals), collected this month (Finance revenue), outstanding invoices and a six-month trend. Finance, Billing and Invoices use the shared table and pill styles.
- **Client portal**: Leads, Calls & Bookings and Reputation Overview tabs are dashboards (tiles, charts, recent items). The old lists live on Contacts, Appointments and Reviews. Help shows request counts above the Support form.
