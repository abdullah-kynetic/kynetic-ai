# Portal design completion running log

2026-11-19. Branch `t3/design-completion` starts at `614b7e40` (origin/main). No deploy or PR is authorized here.

## Recovered sequence and scope

Git and `docs/redesign/` show design system (#191), shell (#192), Today, Clients (#197), Prospecting (#201), Sales (#203), and Money (#205, design position 7). Evidence exists for positions 2–7. Position 8 is Settings per the task. No authoritative list of later positions was found; the inventory below is a route audit, not a claim about the original sequence. Honcho search was queried; its separate synthesis request returned HTTP 503.

Settings candidates: `/dashboard/settings` redirects to business; `/dashboard/settings/business`, `/team`, `/branding`, `/pipeline`, `/tags`, `/notifications`, `/automations`, `/custom-fields`, and `/alex`. Client navigation groups most under Settings; Alex is separately listed. Admin navigation instead groups `/admin/templates` and `/admin/operations` under Build and `/admin/users`, `/admin/backups`, `/admin/archive`, `/admin/audit` under System. The exact intended boundary of position 8 is therefore uncertain; start with client Settings, and classify other pages only after inspecting existing design work.

Remaining route families to inventory against completed work: other client dashboard pages and details, admin Build/System/support/client detail subpages, sign-in/onboarding and shared states. Audit intake/report UI belongs to the audit agent; MCP and its tests belong to the MCP agent. Do not edit those or shared contracts without parent approval.

## Acceptance and ownership

For each changed route preserve existing server guards, tenant and module boundaries, form names/actions, validation and behavior. Apply the existing `DESIGN.md` tokens and page patterns. Verify light/dark where supported, 390/1280 widths, keyboard focus, accessible labels and contrast, long values, overflow, loading/error/empty/dense states, synthetic save/error and permission/module-disabled cases. Capture before/after local synthetic browser evidence. Run documented build, typecheck, lint, unit and integration checks; record exact final commit CI separately. No schema, provider, consent, billing, messaging, auth or live-data changes.

Owned files are the Settings route and component files under `crm/src/app/dashboard/settings/`, route-specific tests/evidence, and this log. Shared shell, tokens and server contracts are out of scope. Later batches must name their files here before editing. Docs alignment follows page work.

## Status

Inventory started; no redesign implemented or verified. The older `docs/ui/AGENCY-DESIGN.md` describes a historical agency pass and conflicts with the newer root `DESIGN.md` on typography; use the newer redesign contract for this sequence. Local dependencies installed with the frozen lockfile. This environment currently has no discovered PostgreSQL binaries, Docker, or browser executable; synthetic browser and integration prerequisites remain to be established.
