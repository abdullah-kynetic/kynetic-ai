# Design System

> **Technical UI rules (scope banner, 2026-11-09).** Not the business roadmap. A Lite/Full module list in this file is the historical 2026-10-25 capability split. Current precedence: `docs/STATUS.md`.

Kynetic Client CRM & Portal. Written 2026-10-25. Feature IDs match the PRD.

**Source precedence:** `DECISIONS_locked.md` wins over `SPEC_client_crm_portal.md`. Brand values come only from `/mnt/project-files/kynetic-brand/rebrand-warm/` (`tokens.css`, `tokens.json`, `palette.html`, `site-color-map.md`). The older purple files in `kynetic-brand/` root are retired and must not be used (2026-10-23 rebrand replaces purple everywhere, including the portal).

**How to read this file:**
- Anything not in the spec, the decisions or the rebrand files is marked `Decided 2026-10-25 (recommended option approved: ...)`. A recommended option is a suggestion to approve, not a decision.
- Contrast ratios were computed for this document from the token hex values (WCAG 2.x relative luminance). They are stated as measured; CI re-verifies them (see Accessibility).
- Feature IDs `F-xx` are taken from the PRD at `/mnt/project-files/kynetic-crm-docs/docs/PRD.md` (F-01 to F-106). F-01 to F-69 match the spec's feature order; F-70 to F-89 are PRD additions (module toggles, auth, isolation, lead intake, upsell modules, tier, secrets, legacy users, n8n). If the PRD changes, the PRD wins. The map is in Appendix A.
- Commands: none in this file. Any command not yet verified is "Not configured".

---

## Design direction

- **Brand attributes:** Decided 2026-10-25 (recommended option approved: the three attributes below, derived from the rebrand palette and the spec's design rules; Abdullah to confirm or replace).
  1. **Warm and premium.** Light-first cream/ivory canvas, espresso bands, champagne-gold rules, Cormorant Garamond for display type. No gradients, no glows (rebrand rule).
  2. **Proof-first.** The product exists to prove ROI (spec goal): the most important numbers sit at the top, each shown against the client's baseline.
  3. **Calm and fast for busy trades owners.** Few controls per screen, progressive disclosure, big touch targets, helpful empty states.
- **Supported devices:** Responsive web, mobile-first for the daily-use pages: contact page (F-06), calls (F-26, F-27), tasks (F-20), calendar (F-24) (spec F-44). Desktop is the primary surface for the admin side, kanban (F-16), tables (F-05) and import (F-38). Installable PWA is Later (F-45). Native iOS/Android apps are not being built (spec "Not building").
- **Themes:** Light is the main theme (rebrand usage target: light 75%, espresso 15-20%, orange 5%, gold 1-2%). A dark theme token set exists in `tokens.css` (`[data-theme="dark"]`). Whether the portal ships a user-facing dark mode in v1 is not stated: Decided 2026-10-25 (recommended option approved: ship light plus dark, because the tokens already exist and the cost is a theme toggle; default to light, store the choice per user, never follow system silently).
- **Client branding rule (decisions, PRD F-39):** v1 branding per client is **logo, primary color, business name** only. Layout and type stay Kynetic's. Custom domain (F-40) and any email sender beyond the business name are **Later**.
- **References:** Approved: `/mnt/project-files/kynetic-brand/rebrand-warm/palette.html` and `tokens.css`. Logo files exist in `/mnt/project-files/kynetic-brand/logo/` (`k-orange.svg`, `k-tile-espresso.svg`, `wordmark-*.svg`, and PNGs) but their approval status for the portal is not recorded: Decided 2026-10-25 (recommended option approved: Abdullah names the one portal symbol; the color map notes the live site K and the old portal tile did not match). Layout reference for data model and screens: Atomic CRM (MIT, reference only). Component base: Kiranism next-shadcn-dashboard-starter (MIT; Next.js 16, React 19, Tailwind 4, TanStack, Recharts, dnd-kit, kbar). No Figma or other design file exists in the sources: Decided 2026-10-25 (recommended option approved: the starter plus `palette.html` is the visual reference until a design file is made).

---

## UI tokens

Record actual approved values, not guesses. Values in the "Value" columns come straight from `tokens.css`/`tokens.json`. Anything marked Decided 2026-10-25 was approved by Abdullah (explicitly or as the recommended option).

### Color: light theme (default)

| Token | Value | Usage | Measured contrast |
| --- | --- | --- | --- |
| color.background (`--k-bg`) | `#faf8f5` | Main canvas | |
| color.surface (`--k-surface`) | `#ffffff` | Cards, popovers, dialogs, table body | |
| color.alt (`--k-alt`) | `#f2eee8` | Alternate bands, table header, sidebar hover | |
| color.border (`--k-border`) | `#e8e2d8` | Decorative hairlines and dividers only | 1.22:1 on bg (decorative only; see input border) |
| color.text (`--k-text`) | `#14100c` | Primary copy | 17.86:1 on bg, 18.93:1 on surface |
| color.muted (`--k-muted`) | `#5c5650` | Secondary copy, helper text, placeholders | 6.83:1 on bg, 7.24:1 on surface, 6.26:1 on alt |
| color.primary (`--k-accent`) | `#D9662A` | Fills only: primary button, selected state, active-nav marker, logo mark | 3.37:1 vs bg, 3.57:1 vs surface (passes 3:1 for UI components, fails 4.5:1 as text) |
| color.primary-hover (`--k-accent-hover`) | `#E2723A` | Hover on primary fills (lighter so the dark label keeps contrast) | label 6.2:1 |
| color.on-primary (`--k-on-accent`) | `#0e0d0b` | Label on primary fills. **Never white**: white on `#D9662A` is 3.57:1 | 5.44:1 on primary |
| color.primary-text (`--k-accent-text`) | `#A8461A` | Orange text, links, money figures | 5.57:1 on bg, 5.91:1 on surface, 5.11:1 on alt |
| color.primary-text-hover (`--k-accent-text-hover`) | `#8F3B15` | Hover on orange text/links | |
| color.gold (`--k-gold`) | `#8A6A2F` | Labels, rules, dividers on page and cards | 4.74:1 on bg, 5.02:1 on surface |
| color.gold-on-alt (`--k-gold-on-alt`) | `#7A5C26` | Gold on `color.alt` sections (`#8A6A2F` is 4.3:1 there) | 5.37:1 on alt |
| color.error (`--k-error`) | `#B3261E` | Errors with text labels, overdue, failed | 6.17:1 on bg, 6.54:1 on surface |

### Color: dark theme (`[data-theme="dark"]`, and the `.k-espresso` band scope)

| Token | Value | Usage | Measured contrast |
| --- | --- | --- | --- |
| color.background | `#1C1916` | Canvas / espresso band | |
| color.surface | `#26211C` | Cards | |
| color.alt | `#221e1a` | Alternate bands (dark theme only) | |
| color.border | `#3A332B` | Hairlines | 1.41:1 on bg (decorative only) |
| color.text | `#f4f1ea` | Primary copy | 15.51:1 on bg |
| color.muted | `#b9b2a7` | Secondary copy (dark theme) | 8.32:1 on bg, 7.59:1 on surface |
| color.primary | `#D9662A` | Fills; label stays `#0e0d0b` | 4.90:1 vs bg, 4.47:1 vs surface |
| color.primary-text | `#E07A3F` | Orange text, links | 5.85:1 on bg, 5.34:1 on surface. `#D9662A` as text is 4.47:1 on cards: large numbers only |
| color.gold | `#C9A96E` | Labels, rules | 7.13:1 on surface. Never on light (2.2:1 on white) |
| color.error | `#FF8A80` | Errors | 7.67:1 on bg, 6.99:1 on surface |

Note: `.k-espresso` only overrides bg, surface, border, text, accent-text and gold. It does not override `--k-muted` or `--k-error`; inside an espresso band on the light theme those would stay light-theme values (`#5c5650` on `#1C1916` is not readable). Implementation must either scope the full dark set to `.k-espresso` or avoid muted/error text inside bands. Decided 2026-10-25 (recommended option approved: define `.k-espresso` as the complete dark token set so bands inside the light theme are safe).

### Color: not in the base tokens (Decided 2026-10-25, approved)

| Token | Value (approved 2026-10-25) | Why |
| --- | --- | --- |
| color.border-strong | Light `#857d72` (4.06:1 on white, 3.83:1 on bg, 3.51:1 on alt). Dark `#8a8379` (4.26:1 on surface, 4.67:1 on bg) | Input, checkbox and select borders must be 3:1 against their background (WCAG 1.4.11). The approved `color.border` is 1.22:1, which is only fine for decoration. |
| color.success | Light text/icon `#1E7A46` (5.04:1 on bg, 5.35:1 on white). Dark `#6FBF8E` (7.23:1 on surface) | Spec rule 2: green = booked or won. The color map lists `#6FBF8E` as new and says it "needs your yes"; it is 2.21:1 on white so it cannot be the light-theme text color. The light value is my recommended option. |
| color.warning | Reuse gold: light `#8A6A2F`, dark `#C9A96E` | The color map maps the old neon yellow status to gold. |
| color.info / neutral | Neutral = `color.muted` text on `color.alt`; info = `color.primary-text` | No info color is defined. Avoid blue (the color map calls the old blue "not a brand color"). |
| color.focus-ring | `color.primary-text` (light `#A8461A`, 5.57:1 on bg), 2px with 2px offset; dark `#E07A3F` | Visible focus is required; see Accessibility. |
| color.scrim (dialog backdrop) | `#14100c` at 50% | Flat, no blur or glow. |
| chart.series-1..5 | 1 `#A8461A` (dark `#E07A3F`), 2 `#8A6A2F` (dark `#C9A96E`), 3 `#14100c` (dark `#f4f1ea`), 4 `#5c5650` (dark `#b9b2a7`), 5 `#1E7A46` (dark `#6FBF8E`) | Recharts needs a categorical set. Always pair with direct labels or patterns so color is not the only signal. |

### Typography

| Token | Value | Usage |
| --- | --- | --- |
| font.display | Cormorant Garamond, Georgia, serif | Page titles (H1), login and empty-state headings. Weight and sizes below are Decided 2026-10-25 (recommended option approved: 600, 32/36 desktop, 28/32 mobile). |
| font.body | Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif | Everything else: body, tables, forms, buttons, nav, stat numbers. Decided 2026-10-25 (recommended option approved: 14px / 400 / 20px line height in dense tables and lists, 16px / 400 / 24px for body on mobile and in forms; inputs 16px on mobile to prevent iOS zoom). |
| font.numeric | Inter with `font-variant-numeric: tabular-nums` | All tables, stat cards, money, durations. Spec rule 3: numbers right-aligned, tabular figures, currency formatted. |
| type scale | Decided 2026-10-25 (recommended option approved: 12, 14, 16, 18, 20, 24, 28, 32 px; headings H2 20/28 Inter 600; H3 16/24 Inter 600; label 12/16 Inter 500, uppercase tracking 0.04em in `color.gold` for section labels) | |

Why numbers are Inter and not Cormorant: Decided 2026-10-25 (recommended option approved: Cormorant's figures are not designed as tabular lining figures for dense data, so stat-card numbers use Inter 600. Cormorant may be used for one oversized hero number per page only if lining figures are enabled and Abdullah approves; verify on `palette.html`). This is a judgement call, not a sourced rule.

Fonts are self-hosted via `next/font` (Decided (recommended option approved); the spec does not say. Self-hosting avoids a third-party request on a portal handling client data).

### Spacing, radius, elevation, motion

| Token | Value | Usage |
| --- | --- | --- |
| space.unit | Decided 2026-10-25 (recommended option approved: 4px base; scale 4, 8, 12, 16, 24, 32, 48, 64 = Tailwind 1, 2, 3, 4, 6, 8, 12, 16) | All padding, gaps, margins |
| radius.control | Decided 2026-10-25 (recommended option approved: 8px) | Inputs, buttons, selects, chips are fully rounded (9999px) |
| radius.card | Decided 2026-10-25 (recommended option approved: 12px) | Cards, popovers, dialogs |
| elevation | Decided 2026-10-25 (recommended option approved: none. Separate with 1px `color.border` hairlines and `color.alt` fills. Rebrand rule: no gradients, no glows. A single flat shadow for popovers/menus only if needed to separate from content: `0 1px 2px rgb(20 16 12 / 12%)`) | |
| motion | Decided 2026-10-25 (recommended option approved: 120-200ms ease-out for hover, popover, toast; 200ms for drawer slide. No parallax, no looping animation. Honor `prefers-reduced-motion`: replace movement with instant or opacity-only change.) | |
| target size | 44px minimum touch target (spec design rule 9). Desktop dense rows may be 36px tall but the whole row must still have a 44px tap area on touch devices. | |

### Tokens in code

- `tokens.css` is the source. Implementation maps `--k-*` onto the shadcn/ui variable names (`--background`, `--foreground`, `--card`, `--primary`, `--primary-foreground`, `--muted-foreground`, `--border`, `--destructive`, `--ring`). Components consume the shadcn names; no component may hard-code a hex value. This mapping is my recommended option; the starter's shadcn variable names are the only given fact.
- The starter ships its own theme presets. Decided 2026-10-25 (recommended option approved: remove all starter themes/presets in M0; the portal has exactly the Kynetic tokens plus tenant primary override).
- Tenant override: `tenants.primary_color` (spec data model) is injected as CSS variables on the app shell element (server-rendered, so there is no flash of the wrong color). See "Per-client branding".

---

## Per-client branding (F-39)

Spec rule: client branding swaps **logo and primary color only; layout and type stay Kynetic's**. Decisions: v1 = logo, color, name. The business name is text shown in the sidebar header, page title and branded emails.

### What a tenant's primary color changes

Changes: `color.primary` (fills), and the three values derived from it (on-primary, primary-hover, primary-text). Used by: primary button, selected row/tab/nav marker, toggle on-state, focus ring, links, charts series 1, the tenant logo placeholder tile (initials).

Does not change: everything else. Specifically it never replaces `color.error`, `color.success`, `color.warning`, the espresso band, gold rules/labels, the surface/background/text neutrals, or any status chip. Status color is data, not brand (spec rule 2).

### How a client primary interacts with Kynetic orange and contrast (Decided 2026-10-25, approved)

Problems to solve: (a) tenant colors can fail contrast, (b) a tenant color can look like an error or success state, (c) the Kynetic orange `#D9662A` and a tenant color should not appear together in the tenant UI and read as two competing brands.

Approved rules:
1. **Kynetic orange is not shown in tenant-facing screens** except where Kynetic identity is intended (the pre-login/sign-in page before a tenant is known, and optionally a small "Powered by Kynetic" footer). Inside a tenant, `color.primary` = the tenant color. If a tenant has no color set, the tenant falls back to Kynetic orange.
2. **The admin side (F-53 to F-69) always uses Kynetic orange.** In "View as client" (F-57) the page content takes the tenant color, but the banner and admin chrome stay Kynetic (espresso band, see below), so the admin always knows whose view it is.
3. **Derive, don't trust.** When the owner saves a color, compute and store (or compute at render, same code on server) these values per theme:
   - `on-primary`: whichever of `#0e0d0b` and `#ffffff` gives the higher contrast on the color, minimum 4.5:1. (Kynetic orange gets dark text for this reason.)
   - `primary-hover`: shift lightness about 6% toward the on-primary's opposite so the label keeps its contrast.
   - `primary-text` (links, money, text-on-light): darken in OKLCH until it reaches 4.5:1 on `#ffffff`, `#faf8f5` and `#f2eee8`. Dark theme: lighten until 4.5:1 on `#26211C` and `#1C1916`.
4. **Reject at input** a color whose fill contrast against `#faf8f5` or `#26211C` is below 3:1 (WCAG 1.4.11 for UI components) in the theme the user is in, and show the suggested nearest passing color ("Too light for buttons. Use #xxxxxx?"). Very light colors (yellow, pale pastel) fail this. This is a hard validation, shown with the measured ratio.
5. **Warn, don't block,** when the hue is within about 20 degrees of the error red or the success green (a red brand button reads as a destructive action). The warning text states why.
6. **Gold and espresso stay Kynetic's** (labels, rules, sidebar band). A blue or green tenant therefore sees tenant color + espresso + gold. Gold is 1-2% of surface area by the rebrand rule, so this is acceptable. If Abdullah disagrees, the alternative is to drop gold in tenant views.
7. **Logo.** Accept SVG/PNG, transparent background. The logo is rendered on a cream (`color.alt`) chip, not directly on espresso, so a dark-on-transparent logo is always legible (see Navigation). Max display height 32px in the sidebar, 40px in emails. If no logo, show a tile with the business initials in `color.on-primary` on `color.primary`.
8. **Emails** use the same derived values (inline, because email clients ignore CSS variables) and always show the Kynetic-neutral footer. Sender display name = the business name (v1). A custom sender domain is Later (F-40).

Verification: the derivation function is unit-tested (Vitest) against a table of edge colors (white, black, yellow, red, green, the Kynetic orange); a failing case blocks merge. Test file path: Not configured.

---

## Layout rules

- **Container widths, gutters, breakpoints:** Decided 2026-10-25 (recommended option approved: use Tailwind 4 default breakpoints that the starter uses: sm 640, md 768, lg 1024, xl 1280, 2xl 1536). Content max width 1280px for dashboard and lists, 720px for forms/settings, full width for kanban and calendar. Page gutter 16px mobile, 24px tablet, 32px desktop.
- **App shell:** left sidebar (collapsible to icons) + top bar + content, as in the starter. Below `lg` the sidebar becomes a slide-over drawer, and the primary destinations are also on a bottom tab bar on mobile (Decided (recommended option approved): Home, Contacts, Calls, Calendar, Tasks; "More" opens the drawer).
- **Grid and spacing:** 12-column grid at `lg+`, single column below `md`. Stat cards: 4 up at `xl`, 2 up at `md`, 1 up (or 2 compact) on mobile. Vertical rhythm in multiples of 4px; 24px between cards; 16px inside cards (12px mobile compact).
- **Alignment:** left-align text; right-align numbers, currency and durations in tables with tabular figures (spec rule 3). Action buttons right-aligned in dialog footers; primary action rightmost on desktop, full-width stacked on mobile.
- **Hierarchy:** one job per page; the most important numbers sit at the top (spec rule 1). Page header = H1 (display font) + one-line description + primary action.
- **Mobile behavior (F-44):** every screen is checked at a 390px viewport with no horizontal page scroll (tables become cards, see below); touch targets 44px minimum.

  - Tables (F-05, F-10, F-26, F-30) collapse to a card list on `< md`: line 1 name/primary field, line 2 status chip + key value, tap row opens the record. Column show/hide stays on desktop only.
  - Contact page (F-06) puts tap-to-call and tap-to-text as sticky bottom actions. Phone numbers are `tel:` and `sms:` links (F-44).
  - Kanban (F-16) scrolls columns horizontally with scroll-snap; each card has a "Move to stage" menu because touch drag is unreliable. Drag stays on pointer devices.
  - Slide-out panels (F-07) become full-screen sheets on mobile.
  - Calendar (F-24) defaults to day view on mobile, week on tablet, month on desktop.
  - Forms are single column; inputs 16px text; numeric/phone fields set the right `inputmode`.
  - Bulk actions (F-08) appear in a sticky bar at the bottom when rows are selected.
- **Admin side:** desktop-first (dense tables), still usable on a phone for health checks (F-53, F-54, F-62). Not mobile-first.

### Navigation and module gating

Spec data and decisions: every upsell is a per-tenant toggleable module with server-side gating, and **UI is hidden when off** (not greyed, not locked).

Navigation structure (Decided (recommended option approved); item names are from the spec feature groups):

| Nav item | Always on | Module-gated |
| --- | --- | --- |
| Home (F-01 to F-03) | yes | Cards from a module appear only if that module is on |
| Contacts (F-05 to F-09), Companies (F-10, F-11), Deals (F-14 to F-18) | yes (CRM core) | |
| Tasks (F-20), Notes (inside records, F-22), Calendar (F-24) | yes | |
| Calls (F-26 to F-29) | | Alex core |
| Messages log (F-30) | | any module that sends messages (Alex core, text-back, follow-up bundle, reactivation); owned by `alex_core` and shown whenever any messaging module is on |
| Automations (F-31 to F-33) | | Template cards individually gated: speed-to-lead (Alex core), old-lead reactivation, quote follow-up, appointment reminders, no-show recovery, missed-call text-back (text-back / after-hours) |
| Reports (F-49) | yes | Sections gated by module (e.g. OPM section appears only with OPM) |
| Settings (F-41 to F-43) | yes (owner) | Alex section only with Alex core (F-42) |
| Notifications (F-35) bell | yes | |

Rules:
1. Gated items are **not rendered at all** when the flag is off: nav item, dashboard card, settings section, Cmd+K entries (F-37), search result groups, report sections, notification types, and automation templates.
2. A gated module's route returns 403 `MODULE_DISABLED` for direct URL access, enforced server-side (PRD F-70). The UI never links to it. A record belonging to another tenant still returns 404, so existence is never revealed across tenants; hiding the link is never the only protection. The UI reads the tenant's flag set from one server-provided object so every surface agrees.
3. No disabled or "upgrade" teaser is shown to clients in v1. Nav, dashboard cards and settings sections collapse cleanly when a module is off, with no empty gaps (test each module off in Playwright at 390px and 1280px). An in-portal add-on page is not built; the spec's "sell add-ons inside the portal" goal is open (PRD decision 1 and the spec's business goal).
4. The admin side shows every module as a labeled toggle per tenant (on/off, with who changed it and when via the audit log, F-60). Module toggles are F-70 in the PRD (the spec had no row for them).
5. Module list (from decisions): Alex core, quote follow-up, after-hours/missed calls, missed-call text-back, old-lead reactivation, Online Presence Management (OPM), follow-up bundle, CRM build-out (Lite/Full). What CRM Lite vs Full adds on top of the base portal is defined in PRD F-85: Decided 2026-10-25 (PRD decision 1): the base portal (leads, kanban, appointments, calls, reports) is always there; Lite adds companies, tasks, notes, stage settings; Full adds custom fields, bulk actions, multi-contact deals, search, export. OPM has no UI defined beyond "monthly portal report": Decided 2026-10-25 (recommended option approved: an OPM tab inside Reports showing GBP, reviews, listings and posts summary; PRD to specify).

### Shell chrome (Decided (recommended option approved))

- **Sidebar:** espresso band (`.k-espresso` full dark token set) in both themes. This gives the rebrand's 15-20% espresso share and a clear frame. Tenant logo sits on a cream chip (`color.alt`) at the top. Active item: `color.primary` marker 3px on the left plus `color.surface`-tinted background; text `#f4f1ea`.
- **Top bar:** `color.background`, 1px bottom hairline. Contains: breadcrumb/page title, Cmd+K trigger (F-37), notifications bell (F-35), user menu.
- **View-as banner (F-57):** a full-width, sticky, always-visible band above the top bar: espresso with `#C9A96E` gold text, "Viewing {Business name} as {admin name}. Read-only." plus an "Exit" button. It is never tenant-colored and cannot be dismissed. Write actions are visibly disabled in read-only mode with a tooltip explaining why; this is the one place where disabled-with-explanation is correct (the user is Kynetic staff, not a client).

---

## Components

All components are shadcn/ui primitives from the starter, restyled only through tokens. Every interactive component defines these states: **default, hover, focus-visible, active, disabled, loading, success, error**. Common rules:

- Focus-visible: 2px ring in `color.focus-ring` with 2px offset; never removed.
- Disabled: 45% opacity may not be used on text that must be read (it fails contrast). Disabled = `color.alt` fill + `color.muted` text, `aria-disabled`, and a tooltip stating why where the reason is not obvious.
- Loading: replace the label with a spinner of the same width (no layout shift) and set `aria-busy`; do not disable focus order.
- Success/error: never color alone. Pair with an icon and text.
- Hover is a pointer-only affordance; every hover-revealed action (spec rule 4, rare actions on row hover) is also reachable by keyboard and on touch via the row's "..." menu.

### Buttons

- **Primary button:** fill `color.primary`, label `color.on-primary`, 8px radius, 40px tall desktop / 44px mobile, 16px horizontal padding, Inter 500 14px. Hover `color.primary-hover`. Active: `color.primary` with 1px inset darker border. One primary per view region. Loading shows spinner + label stays for screen readers.
- **Secondary:** `color.surface` fill, 1px `color.border-strong`, text `color.text`. Hover `color.alt`.
- **Ghost/tertiary:** transparent, text `color.primary-text`, underline on hover.
- **Destructive:** `color.error` text and border on `color.surface`; confirm dialog fills `color.error` with `#ffffff` label (white on `#B3261E` = 6.54:1). Delete, merge (F-07) and bulk delete (F-08) always open a confirm dialog that states the count and consequence.
- **Icon button:** 44px target, tooltip required (spec rule 4: tooltips on every metric and icon), `aria-label` required.

### Form field (inputs, textarea, select, date, combobox, checkbox, switch)

- Anatomy: visible label above, optional helper text below, field, error text below the field (replaces helper text). Required fields marked "(required)" in text; optional fields unmarked. Placeholder is an example only, never the label.
- States: default border `color.border-strong`; hover darker border; focus ring (see above); filled; disabled; read-only (no border, plain text); error = `color.error` border + icon + message; success only after async validation (e.g. unique slug) shown as a check + text.
- Validation: Zod schemas shared with the server; validate on blur and on submit, never on first keystroke. On submit with errors, focus the first invalid field and show a summary at the top of long forms (`role="alert"`). Error messages are specific ("Enter a 10-digit US phone number"), not "Invalid".
- Phone, email, money: money is entered in dollars, stored as cents (`value_cents` per spec data model), displayed with the currency symbol and thousands separators. Phone shows national format; stored E.164. Multi-value fields (phones[], emails[] on F-06) are repeatable rows with a primary marker.
- Custom fields (F-12): rendered by `custom_field_defs.type` (text, number, money, date, select, multi-select, checkbox) in the same field component; they appear in the same position in forms, tables and import mapping as built-in fields, and are visibly labeled by the tenant's label text.

### Cards and stat cards

- Card: `color.surface`, 1px `color.border`, 12px radius, 16px padding, no shadow. Card title Inter 600 14px.
- **Stat card (F-01):** label (12px, muted, with a tooltip explaining the metric, spec rule 4), value (Inter 600, 28px, tabular), baseline comparison line ("Baseline: 3.1 booked/week at signup"), trend chip. Trend chip: up/down arrow + percent + sr-only text ("up 12% vs baseline"). Colors: good direction = `color.success`, bad = `color.error`; "good" depends on the metric (speed-to-lead down is good), so each metric defines its own polarity.
- Cards that are links are fully clickable with a visible focus ring on the card.

### Chips and badges

Status and category are colored chips (spec rule 2). Chip = icon + text, 24px tall, pill radius, tinted background at about 12% of the tone on `color.surface`, text in the tone's text color. Tone mapping (Decided (recommended option approved); the spec fixes only red = overdue or failed, green = booked or won):

| Tone | Used for |
| --- | --- |
| success | Call outcome: booked; deal stage: Won; appointment: completed; message: delivered; health: green |
| info | Call outcome: qualified, transferred; deal stage: New, Contacted, Qualified, Estimate Booked, Estimate Done, Quoted; appointment: scheduled |
| neutral | Call outcome: not interested, voicemail, no answer; deal stage: Lost (Decided: Lost is neutral, not error) |
| warning | Health: yellow; integration degraded; consent expiring/unknown |
| error | Call outcome: DNC; task overdue; message failed; integration failing; appointment no-show; health: red; consent revoked |

Tags (F-05) are user-defined: neutral outlined chip with text; no per-tag color in v1 (Decided (recommended option approved): allow a tag color from the neutral/info/gold set only, so user-chosen colors never imitate status).

### Data table (F-05, F-10, F-26, F-30, F-53, F-60, F-62)

TanStack table. Header row `color.alt`, sticky; sort indicator with `aria-sort`; sortable headers are buttons. Row height 44px (comfortable), 36px (dense, user toggle, desktop only). Selected row: `color.primary`-tinted background (8%) + checkbox. Numbers right-aligned, tabular. Truncated text has a tooltip with the full value. Saved views (F-05, URL-saved) show as tabs above the table; view state lives in the URL query so links are shareable. Pagination footer shows "x-y of N" and a page-size select. Row actions in a "..." menu at the row end; the primary row action is clicking the row (a real link, so middle-click and keyboard work).

### Dialog, slide-out panel and confirm

- Dialog: centered, 480px (confirm) / 640px (form), scrim, focus trap, Esc closes, focus returns to the trigger, title + description (`aria-labelledby/-describedby`). Footer: secondary left of primary.
- Slide-out panel (F-07 create/edit, F-12 field forms): right side, 480px desktop, full-screen on mobile. Unsaved-changes guard: closing a dirty panel asks to discard.
- Confirm for destructive actions: names the object and count; primary button text is the verb ("Delete 12 contacts"), not "OK".

### Toast

Confirms every action (spec rule 6), bottom-center on mobile, bottom-right on desktop, 4s default, 8s with an action. Undo where possible: task completion (F-20), kanban move (F-16, optimistic move with undo toast), delete (soft delete window, Decided: 10s). `role="status"` (success) or `role="alert"` (error). Errors do not auto-dismiss. Pausing on hover/focus. Never the only record of a failure: failed background operations also go to notifications (F-35) or integration health (F-62).

### Navigation components

- Sidebar, bottom tab bar (mobile), breadcrumbs, tabs (underline style, `color.primary` marker, `aria-selected`), pagination, user menu, date-range picker (F-01, one shared component; presets: 7 days, 30 days, 90 days, custom; default 30 days; the selection is in the URL).
- **Cmd+K (F-37, kbar):** opens on Cmd/Ctrl+K and from a visible search button in the top bar (not keyboard-only); groups: Records (contacts, companies, deals), Pages, Quick create; results are filtered by role and module flags (hidden when off). Input is labeled; the list is an ARIA listbox; Esc closes.
- **Notification bell (F-35):** unread count badge (number, capped "99+"), popover with latest items, "View all" to the full page with tabs. Count is announced to screen readers ("3 unread notifications").

### Charts (F-02, F-03, F-06 reports)

Recharts. Spec rule 7: line or bar only, with a date-range picker. Line chart for booked estimates over time; bar chart for outcomes by lead source. No gradients, area fills with opacity, glow or 3D. 2px lines, round dots only on hover/focus. Gridlines are `color.border`. Axis labels 12px `color.muted`. Series colors from `chart.series-*`. Every chart has: a title, a text summary, a data table alternative (toggle "View as table") and direct labels or a legend; hover/focus tooltip is also keyboard reachable. Empty and loading states per Screen states.

### Kanban (F-16, F-17)

dnd-kit. Column header: stage name, count and dollar total (tabular), stage color marker from tone mapping. Card: deal title, contact name, value, owner avatar, source chip, overdue-task indicator. Drag: pointer sensor + **keyboard sensor** (Space to lift, arrows to move, Space to drop, Esc to cancel) with live-region announcements ("Moved Smith roof to Quoted, position 2 of 5"). Optimistic move with undo toast; on server failure, the card rolls back with an error toast. Filters (owner, source) above the board. "Won" and "Lost" columns are collapsible. Mobile uses the "Move to stage" menu (see Layout rules).

### Timeline (F-19)

One vertical timeline per contact and deal. Item = icon by type (call, SMS, email, stage change, note, task, appointment, automation event), actor label (user, Alex, automation), summary, relative time with absolute time in a tooltip. Filter chips by type. Items link to their detail (call detail F-27). Alex and automation items carry a distinct actor label so staff can tell machine from human actions. Grouped by day.

### Rich text notes (F-22)

Rich-text editor with a small toolbar (bold, italic, list, link), @mention menu (keyboard navigable, lists teammates in the tenant only), pin toggle. Mentions notify (F-35). Editor content is sanitized on save; see SECURITY.md.

### Call detail (F-27)

Layout: header (contact, time, duration, outcome chip, sentiment), audio player (play/pause, seek, 1x/1.5x/2x, keyboard operable), transcript with speaker labels that highlights the current line and seeks on click, AI summary, extracted fields, next step, "Flag for Kynetic review" (F-28) with a reason field and a confirmation toast. Recording disclosure state is shown if stored (security requirement). Per-call cost is hidden (F-29 is Later; decision: call-cost visibility = Later).

### Appointment calendar (F-24)

Month/week/day views. Appointment block shows time, contact, status chip; color by status tone not by user. Create/reschedule via dialog and by drag on desktop (with keyboard alternative: "Reschedule" action). Today marker uses `color.primary-text`. Business hours shading comes from settings (F-41); Alex bookings outside business hours do not occur (M5 acceptance). Times shown in tenant timezone with the timezone named once in the header.

### Empty / loading / error primitives

Reusable components: `EmptyState` (icon, display-font title, one sentence, primary action), `Skeleton` (flat `color.alt` blocks, no shimmer gradient: pulse opacity only, and static under reduced motion), `ErrorState` (message, "Try again", and a reference id for support), `NoAccess` (for role limits, rarely needed because UI hides what a role cannot do, spec security).

---

## Accessibility

Target: WCAG 2.2 AA. Decided 2026-10-25: WCAG 2.2 AA is the acceptance bar (PRD decision 13).

- **Keyboard navigation and visible focus:** every action works with the keyboard in a logical order; a "Skip to content" link is first on every page; focus ring 2px `color.focus-ring` is always visible and at least 3:1 against adjacent colors (A8461A vs bg 5.57:1); dialogs trap focus and restore it; the kanban (F-16), table sort, Cmd+K, date-range picker, calendar and audio player have documented key bindings; no keyboard traps; no action is drag-only; no action is hover-only.
- **Contrast:** text 4.5:1 (3:1 for 18px+ or 14px bold); UI components and graphics 3:1; text on `color.primary` fills uses `color.on-primary` (never white on `#D9662A`, 3.57:1); orange text uses `color.primary-text` (`#A8461A`, not `#D9662A`); gold text on `color.alt` uses `#7A5C26`; green text in light theme uses `#1E7A46`, not `#6FBF8E`. Measured values are in the token tables above.
- **Color is never the only signal:** chips carry text and an icon; charts carry labels and a table view; required fields say "(required)"; trends say "up" or "down" in text.
- **Semantic labels:** landmarks (`header`, `nav`, `main`), one H1 per page, form labels bound to inputs, `aria-describedby` for helper and error text, icon buttons labeled, tables use real `<table>` semantics with `scope` headers, status updates use live regions, the notification count and kanban moves are announced.
- **Motion:** respect `prefers-reduced-motion` (no slide or pulse; instant state changes); no autoplay, no flashing; spec/brand already ban glows and gradients.
- **Touch:** 44px targets (spec rule 9), 8px minimum spacing between adjacent targets; text zoom to 200% and 320px width reflow without horizontal scroll (tables become cards on mobile).
- **Language and time:** `lang="en"` (multi-language UI is not being built, spec). Dates/times unambiguous (e.g. "Tue, Nov 3, 2:30 PM PT").
- **Verification method:** Not configured. Decided 2026-10-25 (recommended option approved: `eslint-plugin-jsx-a11y` in lint; `@axe-core/playwright` scan of each key screen in the Playwright suite, failing on serious/critical; a contrast unit test over the token pairs in this file and over the tenant color derivation; a manual keyboard pass and a screen reader pass (VoiceOver on iOS) before M10 sign-off). Commands are filled in once CI is configured (M0).

---

## Screen states

Every screen below defines all four states. A "journey" is a PRD user journey; the PRD assigns IDs, so this column says "PRD" until it does. Shared rules: loading shows skeletons matching the final layout (no spinner-only pages) and the shell renders immediately; empty states always include the next action (spec rule 5); errors say what failed and how to retry; populated states follow the component rules above. Permission-limited users never see controls they cannot use (spec security: UI hides what a role cannot do).

| Screen (F-xx) | Journey | Empty | Loading | Error | Populated |
| --- | --- | --- | --- | --- | --- |
| Home dashboard (F-01 to F-03) | PRD | New tenant, no leads yet: "Your results will appear here once Alex receives your first lead", with a "Send a test lead" action (owner) and the baseline card showing starting numbers. Guarantee tracker shows 0 of target and the start date. | Stat-card and chart skeletons | Per-card error with retry; a failing card never blocks the others. "Last updated" time shown. | Stat cards vs baseline with trend chips, two charts, activity feed, guarantee tracker |
| Contacts list (F-05, F-07, F-08, F-09) | PRD | "No contacts yet. Add one, import a CSV, or wait for your first lead." with Add and Import buttons. With filters applied and no match: "No contacts match. Clear filters." | Table skeleton rows (10) | Inline error banner with retry; table keeps last good data if refetching | Table with saved view tabs, bulk bar on select |
| Contact page (F-06, F-19, F-20, F-22) | PRD | Sections each have their own empty line (no notes, no tasks, no timeline yet) with an add action; consent status always shown (explicit "No consent recorded") | Header skeleton + section skeletons | If the contact does not exist or is another tenant's: standard 404 (never reveal existence). Section-level errors with retry. | Details, timeline, tasks, notes, linked deals |
| Companies (F-10, F-11) | PRD | "No companies yet" + Add | Skeleton | Retry banner | Company page with rolled-up contacts and deals |
| Deals board (F-14 to F-18) | PRD | Default stages shown with empty columns and a "Add deal" action in the first column | Column skeletons | Failed move: card returns to origin + error toast; board load failure: retry banner | Cards with column counts and dollar totals |
| Tasks / My Tasks (F-20) | PRD | "Nothing due. You're caught up." (not a punishment tone) with Add task | Row skeletons | Retry banner; failed completion rolls back with toast | Overdue / Today / Upcoming groups; overdue uses error tone |
| Notes (F-22) | PRD | Within record: "Add the first note" | Skeleton lines | Save failure keeps the draft in the editor and shows retry | Pinned first, then newest |
| Calendar (F-24) | PRD | "No appointments in this range. Alex will add booked estimates here." | Grid skeleton | Retry banner; reschedule failure restores the old time | Appointments with status chips |
| Calls list (F-26) | PRD | "No calls yet. Alex's calls will appear here as soon as the first lead is called." | Table skeleton | Retry banner | Rows with outcome chips, duration, sentiment |
| Call detail (F-27, F-28) | PRD | Transcript pending: "Transcript is still processing" with status; recording missing: message and no player | Header + player skeleton | Recording fails to load: transcript still shown, "Recording unavailable, retry" | Player, transcript, summary, fields, flag |
| Messages log (F-30) | PRD | "No messages sent yet" | Skeleton | Retry; failed message rows show the provider error summary (no secrets) | Rows with delivery status chips |
| Automations (F-31 to F-33) | PRD | Never empty: shows the templates the tenant's modules allow, each off/on | Card skeletons | Toggle failure reverts and toasts | Template cards with on/off, config, last run |
| Notifications (F-35) | PRD | "You're all caught up" | Skeleton | Retry | Tabs, unread emphasis, link to record |
| Search / Cmd+K (F-37) | PRD | No query: recent records and pages. No result: "No results for 'x'" + quick create | Inline "Searching..." (no layout jump) | "Search is unavailable. Try again." | Grouped results |
| Onboarding import (F-90 to F-94, F-96), admin side on the tenant page | PRD | Step 1: upload area for CSV or Excel, record type, source name, a downloadable sample file | Progress bar with row counts | Per-row error report downloadable; commit button disabled until a dry run passes; no partial silent failure | Stepper: upload, map columns, preview, dry-run report (ok, failed, duplicates), commit; import history list with Undo batch (confirm dialog). A notice states that imported contacts are not contacted automatically |
| Export (F-38) | PRD | n/a | Spinner | Retry | Export current table view |
| Settings, branding (F-39 to F-43) | PRD | Pre-filled from onboarding; a missing logo shows the initials tile | Form skeleton | Save failure keeps edits; contrast rejection shown inline with the measured ratio and a suggested color | Live preview of the tenant color on a sample button, link, chip |
| Reports (F-49) | PRD | "Your first report will be ready after the first full month" (no empty PDF) | Skeleton + "Generating..." | "Report failed to generate", retry; support reference id | Report list with open/download |
| Admin: all clients (F-53, F-54) | PRD | "No clients yet" + Onboard client | Table skeleton | Retry | Table with health chips |
| Admin: onboarding (F-55) | PRD | n/a | Progress steps while provisioning | Failure shows which step failed and what was already created (idempotent retry) | Success page with links: owner invite, tenant, Alex config draft |
| Admin: Alex config (F-58) | PRD | Draft with required fields flagged | Skeleton | Test call failure shows provider error | Form + test call result |
| Admin: audit log (F-60), user mgmt (F-61), integration health (F-62), backups (F-63) | PRD | Audit: "No events match" with filters; health: "No integrations configured for this client" | Table skeletons | Retry; the health page itself must degrade gracefully when a provider API is down (shows last known status + time) | Filterable tables; backup status shows last success time, last restore test date |
| Sign-in | PRD | n/a | Button loading state | Wrong/unknown account: generic message that does not reveal whether an account exists | Google sign-in and email magic link (spec) |
| 404 / 403 / 500 | n/a | n/a | n/a | Display-font title, one sentence, "Back to home". 403 only where the user knows the page exists (admin-side pages for staff); a gated module's route returns 403 `MODULE_DISABLED` (PRD F-70); another tenant's record returns 404. | n/a |

---

## Approval

Design owner: Decided 2026-10-25 (recommended option approved: Abdullah, who approved the 2026-10-23 rebrand; Quentin reviews as a client-facing sanity check). Source of truth: `/mnt/project-files/kynetic-brand/rebrand-warm/tokens.css` and `tokens.json` for color and fonts; `palette.html` for visual reference; this file for portal usage rules. A Figma or other design file does not exist: Decided 2026-10-25 (recommended option approved: none for v1, the running preview environment is the design reference).

Change control: a change to any token value or to the tenant-color rule needs Abdullah's explicit yes; nobody edits `tokens.css` in the brand folder from a build thread. Any new color, spacing or radius value introduced in code must first be added to the token tables here.

---

## Appendix A: F-xx map (spec feature order)

Priority, milestone and exact IDs: see PRD (`/mnt/project-files/kynetic-crm-docs/docs/PRD.md`, v3). Milestone placement follows ARCHITECTURE.md (it splits M8 into M8a/M8b and adds M11 for OPM). This appendix only names the features.

| ID | Group | Feature (short) |
| --- | --- | --- |
| F-01 | Results dashboard | Stat cards vs baseline, trend chips, date range |
| F-02 | Results dashboard | Line chart booked estimates, bar chart by source, activity feed |
| F-03 | Results dashboard | Guarantee tracker |
| F-04 | Results dashboard | Custom tabs per client |
| F-05 | Contacts | List: search, filters, sort, columns, paging, URL views |
| F-06 | Contacts | Contact page |
| F-07 | Contacts | Create/edit panel, dedupe, merge |
| F-08 | Contacts | Bulk actions |
| F-09 | Contacts | Saved views shared across team |
| F-10 | Companies | List and page, rollups |
| F-11 | Companies | Logo/enrichment |
| F-12 | Custom fields | Per-tenant field types |
| F-13 | Custom fields | Conditional and computed |
| F-14 | Deals | Deal fields |
| F-15 | Deals | Multiple contacts with role |
| F-16 | Deals | Kanban |
| F-17 | Deals | Configurable pipelines and stages |
| F-18 | Deals | Multiple pipelines |
| F-19 | Activity timeline | Unified timeline |
| F-20 | Tasks | Tasks, My Tasks, reminders |
| F-21 | Tasks | Recurring |
| F-22 | Notes | Rich text, mentions, pin |
| F-23 | Notes | File attachments |
| F-24 | Appointments | Calendar views, CRUD, status |
| F-25 | Appointments | Google Calendar sync |
| F-26 | Alex call logs | Call list |
| F-27 | Alex call logs | Call detail |
| F-28 | Alex call logs | Flag for review |
| F-29 | Alex call logs | Per-call cost |
| F-30 | SMS and email logs | Message log |
| F-31 | Automations | Templates per client |
| F-32 | Automations | Sequences |
| F-33 | Automations | Stage moves and alerts |
| F-34 | Automations | Visual builder |
| F-35 | Notifications | Bell, page, in-app + email |
| F-36 | Notifications | Preferences; SMS/push |
| F-37 | Search and Cmd+K | Global search, kbar |
| F-38 | CSV | Export |
| F-90 to F-94, F-96 | Onboarding import | Wizard, dry-run report, history, undo (admin side) |
| F-95, F-97 | Client-side import, connectors | Later |
| F-39 | Branding | Logo, color, name, email sender name |
| F-40 | Branding | Custom domain |
| F-41 | Settings | Business profile, hours, area, team |
| F-42 | Settings | Alex settings visible to client |
| F-43 | Settings | Pipelines, stages, fields, tags, notifications |
| F-44 | Mobile | Responsive, mobile-first, tap-to-call |
| F-45 | Mobile | PWA |
| F-46 | Booking page | Public self-book |
| F-47 | Two-way texting inbox | Shared inbox |
| F-48 | Reviews | Review requests |
| F-49 | Reports | Monthly ROI report |
| F-50 | Reports | Custom report builder |
| F-51 | Quotes and invoices | Quotes, e-sign, invoices |
| F-52 | Chat / AI chat demos | From starter |
| F-53 | Admin: all clients | Client table |
| F-54 | Admin: health score | 0-100, chips |
| F-55 | Admin: onboarding | One-form tenant creation |
| F-56 | Admin: onboarding | Auto-provision Twilio and agent |
| F-57 | Admin: view as client | Impersonation, banner, logging |
| F-58 | Admin: Alex config | Per-client config, test call |
| F-59 | Admin: Alex config | Prompt versioning |
| F-60 | Admin: audit log | Filterable log |
| F-61 | Admin: user management | Invite, roles, deactivate |
| F-62 | Admin: integration health | Per client and global |
| F-63 | Admin: backups | Status, restore test, manual backup |
| F-64 | Admin: usage and cost | Minutes, SMS, margin |
| F-65 | Phase 2 | Kynetic pipeline |
| F-66 | Phase 2 | Billing and MRR |
| F-67 | Phase 2 | $100K goal tracker |
| F-68 | Phase 2 | Email templates |
| F-69 | Phase 2 | Audit tool link |
| F-70 | Modules | Per-tenant module toggles, server-side gating |
| F-71 | Auth | Google sign-in plus email magic link; admin TOTP (F-98) |
| F-72 | Security | RLS tenant isolation |
| F-73 | Security | Roles and server-side checks |
| F-74 | Compliance | TCPA consent, STOP and DNC |
| F-75 | Compliance | Recording disclosure |
| F-76 | Intake | Per-tenant lead endpoint |
| F-77 | Integrations | Idempotent webhooks |
| F-78 | Alex | Outbound speed-to-lead calls |
| F-79 | Module | Quote follow-up |
| F-80 | Module | After-hours and missed calls |
| F-81 | Module | Missed-call text-back |
| F-82 | Module | Old-lead reactivation |
| F-83 | Module | Online Presence Management |
| F-84 | Module | Follow-up bundle (quote follow-up + reactivation + text-back) |
| F-85 | Module | CRM tier Lite or Full |
| F-86 | Admin | Plan and value tier |
| F-87 | Security | Secrets and rate limits |
| F-88 | Migration | Existing portal users |
| F-89 | Integrations | n8n service-token API and events |

---

## Decisions closed (2026-10-25)

Abdullah approved these explicitly or told us to take the recommended option.

1. **Approval of this file.** Abdullah signs off.
2. **Brand attributes.** The three attributes in this file stand.
3. **Portal symbol/logo.** The primary mark from the 2026-10-23 rebrand logo set in `kynetic-brand/logo/`. The M0 thread picks the file and Abdullah sees it in the first preview. The old purple K tile is replaced (Contradiction 9).
4. **Dark mode in v1.** Yes, toggle included, default light.
5. **Success (green).** Approved: light `#1E7A46`, dark `#6FBF8E`. Neutral/info tone as in the tokens table.
6. **Input border.** Approved: `color.border-strong` for inputs.
7. **Numbers** use Inter; Cormorant for display headings at the weights and sizes above.
8. **Spacing, radius, elevation, motion, type scale, breakpoints.** As specified in this file.
9. **Client primary color rules** as written (Kynetic orange hidden in tenant views, derived on/text colors, 3:1 rejection, hue warning, gold/espresso stay Kynetic's).
10. **Sidebar** is an espresso band with the logo on a cream chip.
11. **Admin modules panel (F-70).** The base portal is always present; Lite and Full surfaces follow PRD decision 1. The OPM UI is a status and task list plus the monthly report section (M11).
12. **In-portal add-on teaser.** None in v1; gated UI is hidden when off (PRD F-70).
13. **Email sender name.** Business name in v1; custom sender domain is Later (F-40).
14. **Accessibility.** WCAG 2.2 AA is the bar (PRD decision 13). Verification tooling: `Not configured` until M0 sets up CI.
15. **Undo window.** 10 s toast; retention follows PRD decision 9.
16. **Messages log (F-30)** is owned by `alex_core`; Lost deals use the neutral tone.
17. Client-editable Alex settings: pause and call hours only (F-42). Per-call cost is hidden (Later). Health score weights and guarantee target: PRD decision 10.

UNRESOLVED (needs outside information): OPM vendor connectors and F-97 connectors, which affect UI only if they are chosen.

## Gap-check screens and rules (2026-10-25)
Approved by Abdullah 2026-10-25 (GP-01 to GP-05).
- **Sign-in and magic-link pages are Kynetic-branded.** The tenant is not known before sign-in, so tenant branding (logo, primary color, name) starts after sign-in. Emails use the tenant's name and logo in the header and a small Kynetic footer. Favicon and app icon stay Kynetic's. With no logo uploaded, the sidebar shows a chip with the business initial.
- **Terms acceptance (F-102)** is a full-page step after sign-in with the document text, a version label and one Accept button.
- **Setup progress (F-100)**: owners see a card on the dashboard until go-live: a short list of steps with done, doing and waiting states and no internal detail. Admins get a checklist tab on the tenant page with owner, due date and status per step.
- **Billing tab (F-99)** on the admin tenant page: modules with setup and monthly amounts, discounts, totals, billing start date, Stripe customer id. Read-only for everyone but admin. Never shown to clients or VAs.
- **Operations page (F-101)**, admin only: kill switch (global and per tenant, with a confirm dialog that names the effect), webhook events with Replay, failed jobs with Retry, suspended tenants, demo reseed. Destructive buttons use the error tone and an undo-free confirm.
- **Documents page (F-103)**: a plain list with kind, title, date and a download button.

## Contradictions found

1. **Spec vs decisions, branding fields.** Spec F-39 (Must) includes branded email sender name; decisions say v1 branding is logo, color and name. Applied: decisions win, sender name follows PRD F-39.
2. **Spec vs decisions, call cost.** Spec F-29 per-call cost is already Later (consistent), but spec open question 3 still asks; decisions settle it as Later, so it is hidden in v1.
3. **Spec vs decisions, auth.** Spec says Better-Auth (Google + magic link); decisions allowed Better-Auth or Auth.js. Resolved: Better-Auth, Google sign-in plus magic link (PRD decision 2), with a TOTP step for Kynetic staff.
4. **Spec "green = booked or won" vs rebrand palette.** The palette's green is dark-theme only, is 2.21:1 on white, and was approved on 2026-10-25 together with a light-theme green, `#1E7A46`.
5. **Rebrand status.** The rebrand was approved on 2026-10-23 per project memory. `tokens.json` still says `"status": "proposal, not applied anywhere"`. This is a to-do for whoever owns `kynetic-brand/`, not for the app. Token values here are taken as approved.
6. **`.k-espresso` scope is incomplete** (does not set muted or error), so a naive espresso band inside the light theme has unreadable muted text.
7. **Spec "layout and type stay Kynetic's" vs spec line "client branding swaps logo and primary color only".** Consistent, but the tenant-set `business name` is also displayed, so "only logo and color" is not literally true; I treated name as the third item per the decisions.
8. **Spec says "Chat / AI chat demo pages: Skip" and "UI hides what a role cannot do"** while the starter ships both; M0 must strip them (spec M0 scope covers this).
9. **Portal tile/logo.** The old portal used a purple gradient K tile; the rebrand bans gradients. The existing portal icon (`portal/src/components/brand/logo.tsx`, `portal/src/app/icon.svg`) must be replaced, not adapted.
