# Portal redesign sequence

[DESIGN.md](../../DESIGN.md) defines portal typography, surfaces, status colors, and layout. The [agency refinement notes](../ui/AGENCY-DESIGN.md) document an earlier pass. The sign-in frame retains its serif treatment, and client workspaces retain their configured brand colors.

| Position | Surface | Local browser evidence |
| --- | --- | --- |
| 1 | Design tokens and primitives | Design contract |
| 2 | Shell and workspace switcher | [Shell](pr-2/) |
| 3 | Admin Today | [Today](pr-3/) |
| 4 | Clients | [Clients](pr-4/) |
| 5 | Prospecting | [Prospecting](pr-5/) |
| 6 | Sales | [Sales](pr-6/) |
| 7 | Money | [Money](pr-7/) |
| 8 | Client Settings | [Settings](pr-8/) |

The follow-up applies the existing portal header and page layout to the legacy client dashboard and admin pages. It covers dashboard lists and details, admin Build and System, support, and client detail subpages. The implementation log records the exact coverage and verification. [Design completion log](../coordinator/design-completion.md)

The Settings and remaining-page browser specs run against the repository’s disposable PostgreSQL fixture and local Next.js production build. The fixture sets stub provider mode and disables outbound. The screenshots show synthetic workspace data at 390px and 1280px. [Settings spec](../../crm/tests/e2e/redesign-settings.spec.ts) [Portal pages spec](../../crm/tests/e2e/redesign-portal-pages.spec.ts)

[Remaining-page captures](portal-pages/) show administrative Backups and Templates and client Leads and Support.
