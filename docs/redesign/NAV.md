# Portal navigation map

Both portal shells show business areas in the sidebar. Each area owns one main page and a shared horizontal, mobile-scrollable tab bar for its sub-pages. The active tab follows the URL. Legacy URLs return HTTP 301 to their new homes.

| Admin area | Main page | Tabs |
| --- | --- | --- |
| Today | `/admin` | — |
| Clients | `/admin/clients` | Board, Live, Demo, Churned, Operations |
| Prospecting | `/admin/prospecting` | Funnel, Scraped leads, Half-enriched, Fully enriched, Campaigns, Human dialer |
| Sales | `/admin/sales` | Pipeline, Inbox, Compose, Free audits, Proposals, Contracts |
| Money | `/admin/money` | Overview, Finance, Billing, Invoices, Usage |
| Settings | `/admin/settings` | Account, Team, Integrations, Build, System |

VAs see Today, Clients, Settings, and Help in the admin shell. Admin-only areas remain guarded on the server. Proposal detail and preview live below Sales; support and system requests live below Clients → Operations; archive and audit live below Settings → System.

| Client area | Main page | Tabs |
| --- | --- | --- |
| Dashboard | `/dashboard` | — |
| Leads | `/dashboard/leads` | Overview, Contacts, Pipeline, Import, Companies, Tasks |
| Calls & Bookings | `/dashboard/bookings` | Overview, Calls, Appointments, Messages |
| Reputation | `/dashboard/reputation` | Overview, Reviews, Referrals, Online presence |
| Settings | `/dashboard/settings` | Account, Team, Branding, Pipeline, Tags, Notifications, Automations, Custom fields, Alex, My systems |
| Help | `/dashboard/help` | Support, Documents, Reports, Usage, Notifications |

Client detail URLs stay below the owning area: contact, company, and deal details under Leads; call details under Calls & Bookings; support and report details under Help. Existing permissions and module checks still apply to destination pages.
