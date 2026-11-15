# Admin side cleanup plan

Status: P7-S1 complete 2026-11-15. The remaining five steps are not built yet. It runs as phase 7 (`docs/phases/phase-7.md`): six steps, one branch, one pull request, and nothing deploys without Abdullah's explicit yes.

The admin side is cleaned up in six small steps (commits on one branch) that change where things are reached from, not what the pages do. Page addresses stay the same except one: the client table moves from `/admin` to `/admin/clients` so `/admin` can become a Today page. No page is rewritten and nothing is deleted.

Basis: a read of the page files and `crm/src/config/nav-config.ts` on 2026-11-14. The live site was not clicked through, so this covers structure, not how each page looks.

## Target menu

Six entries, ordered by how often they are used. The Agency group is already hidden from VAs today (the admin layout filters it out), so Sales stays admin-only.

| Entry | Opens to | Pages inside | Admin | VA |
| --- | --- | --- | --- | --- |
| Today | `/admin` | The work queue (new page) | Yes | Yes |
| Sales | `/admin/agency` | Overview and leads, Inbox, Compose, Human dialer, Campaigns, Proposals, Contracts | Yes | No |
| Clients | `/admin/clients` | Client list, Onboard a client, Support requests, System requests; each client opens with tabs | Yes | Yes |
| Money | `/admin/agency/finance` | Finance, Agency billing, Usage and cost | Yes | No for Usage; to confirm for the rest |
| Build | `/admin/templates` | Template library, Client jobs and integrations (today's Operations) | Yes | Operations only |
| System | `/admin/users` | Users, Backups, Audit log, Archive | Yes | To confirm per page |

Each entry expands in the sidebar to show its pages, so the Sales sub-menu stops living on the page itself.

## What happens to each admin page

All 45 admin pages are covered. Nothing is deleted. "Redirect" means the old address sends you to the new place.

| Page today | Action | Where it ends up |
| --- | --- | --- |
| `/admin` (All clients table) | Move | Table moves to `/admin/clients`; `/admin` becomes Today |
| `/admin/clients` (redirects to `/admin`) | Change | Becomes the one client list |
| `/admin/portals` (Client portals) | Merge | Its status and "Open as client" button become columns in the client list; old address redirects |
| `/admin/view-as` (old list, not in the menu) | Retire | Redirects to the client list; the start form is reused |
| `/admin/clients/new` (Onboard) | Keep | A button at the top of the client list |
| `/admin/clients/[id]` (client overview) | Keep | Gains a tab bar instead of the row of text links |
| 12 client subpages (Systems, Alex, Reports, Documents, Billing, Checklist, Import, Webhooks, Service tokens, Presence, Offboard, Modules) | Group as tabs | Tabs: Overview, Systems, Alex, Reports, Documents, Billing, Setup (Checklist, Import, Webhooks, Tokens, Presence), and Offboard in a danger area. Modules already redirects to Systems |
| `/admin/support` and each thread | Move | Clients > Support; open count shows on Today |
| `/admin/system-requests` | Move | Clients > System requests |
| `/admin/templates` | Move | Build |
| `/admin/operations` | Rename and move | Build, named "Jobs and integrations" so it no longer clashes with Agency operations |
| `/admin/agency` (overview, 394 lines) | Split | Leads, add-a-lead and stages stay as the Sales home; the alerts block moves to Today |
| `/admin/agency/ops` (Agency operations) | Split and clean | The daily summary and client health move to Today. The "DEV integration draft" and "Agency DEV lead secret" blocks point at dev.kyneticai.com, which the repo says is retired; hide them once Abdullah says so |
| Inbox, Compose, Human dialer, Campaigns, Proposals (and its preview), Contracts | Keep | Sales |
| `/admin/agency/finance`, `/admin/agency/billing` | Move | Money |
| `/admin/usage` | Move | Money (admin only, as the tests already require) |
| `/admin/users` | Move | System |
| `/admin/backups`, `/admin/audit` | Move | System |
| `/admin/archive` and its five subpages | Move | System > Archive |

## The Today page

The one new page. It opens at `/admin` and answers "what needs me right now" using blocks the portal already has on other pages. Top to bottom:

1. **Needs you now.** Admin alerts, Agency alerts and failed jobs (today these sit on Operations and the Agency overview).
2. **Sales today.** The next people to call in the Human dialer, callbacks due, and new leads (today on the dialer and Agency overview). Admin only.
3. **Clients needing attention.** Clients whose health is yellow or red, each linking to its page (the health score is already on the client table).
4. **Support.** How many requests are open and the oldest one (today on Support requests).
5. **Daily summary.** The preview block from Agency operations.

An empty block says "Nothing needs you" instead of disappearing, so a clear page can be trusted. A VA sees blocks 1, 3 and 4 only. The blocks reuse existing queries, and admin-only data stays checked on the server, not only hidden in the menu.

## Build order

Each step is its own commit on the phase 7 branch (`docs/phases/phase-7.md`). CI must pass, and nothing deploys without an explicit yes.

| # | Step | Size | Tests that change | What you see afterward |
| --- | --- | --- | --- | --- |
| 1 | Regroup the sidebar into the six entries (menu file only) | Small | None expected | The new menu. Every page still works at its old address |
| 2 | One client list: table moves to `/admin/clients`, Client portals merged in, View as retired; `/admin` redirects there for now | Small to medium | Three end-to-end tests that open `/admin` and expect "All clients" | One list with status, health and "Open as client" |
| 3 | Tabs on each client's page, Offboard in a danger area | Medium | None expected (subpages keep their addresses) | Clear tabs instead of eleven links |
| 4 | The Today page replaces the `/admin` redirect | Medium | New end-to-end test for admin and VA views | A home page that says what needs you |
| 5 | Tidy Sales, Money and Build: rename the two Operations pages, move the alerts block, hide the DEV blocks (needs a yes) | Small | The Agency end-to-end tests if headings change | No duplicate names, no retired-environment leftovers |
| 6 | Remove dead links, update STATUS and progress docs | Small | None | Docs match the product |

The phase merges as one pull request and deploys once, after Abdullah's yes.

## Risks and defaults

- Four existing browser tests open `/admin`. Three expect the client table and move to `/admin/clients` in step 2. The fourth expects a visible "Backups" link in the sidebar, so the System group must stay expanded or the test changes.
- Hiding something in the menu is not security. Every page keeps its own role check, and the Today page checks the role on the server.
- Every page's VA permissions have not been read. Step 1 must not widen VA access, so each page's role check is listed before the menu changes.
- The merged client list must keep the "read-only unless write mode, every session logged, a VA gives a reason" rules on View as client. The existing start form is reused for that reason.

Defaults unless Abdullah says otherwise:

- Sales and Money stay admin-only, as the Agency group is today.
- The DEV blocks on Agency operations are only hidden, not deleted, until removal is approved.
- Support requests live under Clients, with a count on Today.

## P7-S1 role table (read from route guards and server functions)

This table records who can open each existing admin address. “Both” means the route's page guard or its staff helper accepts both `admin` and `va`; action-level permissions remain unchanged.

| Address | Admin | VA | Evidence |
| --- | --- | --- | --- |
| `/admin` | Yes | Yes | admin layout; page has no narrower guard |
| `/admin/agency` and all `/admin/agency/*` | Yes | No | `decideAdminAccess` with admin checks on Agency pages and actions |
| `/admin/clients`, `/admin/clients/new` | Yes | Yes | admin layout; onboarding service retains action guard |
| `/admin/clients/[tenantId]` | Yes | Yes | client overview guard and tenant-scoped service |
| `/admin/clients/[tenantId]/systems`, `/alex`, `/reports`, `/documents`, `/billing`, `/checklist`, `/imports`, `/webhooks`, `/service-tokens`, `/presence`, `/modules` | Yes | Yes | existing client-page guards and tenant-scoped services |
| `/admin/clients/[tenantId]/offboard` | Yes | No | page guard requires `admin` |
| `/admin/portals`, `/admin/view-as` | Yes | Yes | existing staff guard; VA reason is required by `StartViewAsForm` |
| `/admin/support` and `/admin/support/[id]` | Yes | Yes | `decideAdminAccess` staff guard; support service accepts both staff roles |
| `/admin/system-requests` | Yes | Yes | `listSystemRequestQueue` accepts staff role |
| `/admin/templates` | Yes | No | page and actions require `admin` |
| `/admin/operations` | Yes | Yes | page loads read-only staff data; mutations require admin |
| `/admin/usage` | Yes | Yes | `listUsageMonth` receives the authenticated staff role; client costs remain staff-only |
| `/admin/users` | Yes | Yes | page explicitly documents staff list/invite/reset access |
| `/admin/backups` | Yes | Yes | page lists for staff; manual backup action requires admin |
| `/admin/audit` | Yes | Yes | `decideAdminAccess` and audit viewer staff guard |
| `/admin/archive` and `/admin/archive/{notes,tasks,records,attachments}` | Yes | Yes | `requireArchiveStaff` |
