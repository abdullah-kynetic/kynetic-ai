# Unslop audit and direction — 2026-11-20

Method: the unslop skill (heydamir, CC BY 4.0; not copied into the repo) applied to `crm/` on `t3/design-finish`. Audit is code grep plus Playwright screenshots of the built app with stub data: 43 routes across admin, client, VA-visible and public groups, light and dark, 1280 and 390 px. Verdict: **light-to-medium slop**. The Phase 1–4 redesign already removed the loud tells (no gradients, glows, emoji, hype copy, greeting headlines or exclamation marks; sentence case; one icon set). What is left is inconsistency and weight: the same stat tile written seven times, black bars everywhere, 600-weight everywhere, a saturated nav block, charts that show cents as "k".

## Findings by group

### Surfaces and color
- Active sidebar item is a solid black block (light) or a saturated orange block (dark): loudest thing on every screen. (`components/ui/sidebar.tsx`, `app-sidebar.tsx`)
- Charts use the primary ink for every bar: Money revenue bars, Prospecting funnel bars, lead sources bar. Nothing leads, accent unused. (`admin/money/overview.tsx`, `admin/prospecting/funnel.tsx`, `dashboard/metrics-charts.tsx`)
- Client "Lead sources" renders one value as a full-width solid orange rectangle. (`dashboard/metrics-charts.tsx`)
- Shadows: `shadow-sm` on Kanban cards, one custom `shadow-[0_8px_24px…]` on the client menu; otherwise fine. Popovers keep neutral shadows.
- Gradients: only scroll-fade masks in `globals.css` (neutral, allowed).

### Type
- 139 `font-semibold` and a 28/32/40 px page title at 600. The scale allows 400/500, 600 only for rare emphasis.
- Stat labels use `text-[13px]`, descriptions `text-[15px]`, KPI figures at several sizes: no single scale.
- `tracking-tight` / negative tracking on titles is fine (display), but also applied at 18 px in places.
- One uppercase tracked label: command palette group headings. (`kbar/render-result.tsx`)
- Numbers: Money overview shows `$3,600.00` cards next to a chart axis `360k` (the chart plots cents as if dollars), Prospecting overview shows `$3,500.00` overlapping `$142.00` and `$3,358.00` in three columns.

### Icons
- One set (tabler), sizes mostly `size-4`; sidebar and tab icons share a column. No emoji found in `src/` UI strings. Pass is a verification and size/stroke normalisation.

### Spacing
- 15 arbitrary pixel values (`max-w-[1280px]` repeated 7 times, `min-w-[96px]`, `h-[400px]`, `p-[3px]`). The page frame is copy-pasted in seven files rather than shared.
- Stat tiles: seven near-identical copies (`layout/stat-tiles.tsx`, `money/overview.tsx`, `money/invoices/page.tsx`, `prospecting/funnel.tsx`, `today-kpis.tsx`, `clients/page.tsx`, `agency/finance/page.tsx`) with slightly different padding, label size and figure size.
- At 390 px every stat tile is a full-width card; four tiles take three screens before any content.

### Copy
- Page and area descriptions end with a period (`Revenue, cash collection and invoices.`): subheads should not.
- Stat tiles show a label and a figure but no comparison; funnel tiles repeat the same "Open list" under every figure.
- Dashboard (client) subtitle `Results from 2026-10-22 to 2026-11-20.` uses ISO dates; the rest of the portal uses `Nov 20`.
- Skeleton/loading and error copy is plain; no hype words, no `!`, no `AI-powered`.

### Layout
- Prospecting funnel page stacks two headed blocks: dashboard then `Prospecting overview` (a second h2 plus a second set of cards), so the first screen has two "this month" ideas.
- Client dashboard: seven stat tiles in a 4+3 grid with an empty slot; two equal charts side by side.
- Clients board shows five lanes at 1280 with a horizontal scroller; fine, but the stat strip above repeats the lane counts.

### Details
- Counts and meta (`Open client`, `founding · Health 60`) are plain text, not meta in mono; IDs and phone numbers have no consistent meta style.
- Table row states read apart already (checked in Phase 3).
- Radii: card `--radius-card` 20, panel 16, control 12 consistently; Kanban card uses `rounded-lg` (8) inside a 16 lane with 12 padding: should be 4+ and ≤ 16−12.
- Focus rings present everywhere.

### Visuals
- No decorative filler. Moments are product-native: Today headline, Money chart, Clients board, Prospecting funnel. They are not yet differentiated from chrome (all black bars, all same weight).

### Motion
- `animate-pulse` only on skeletons (with `motion-reduce` on one of three); `transition-all` in six primitives (sidebar rail, tabs, toggle, input-otp, switch, infobar rail). No hover scale, no loops, no bounce.

## Direction

- **Product.** Kynetic AI runs an AI receptionist for home-service companies, and this portal is where staff run clients, prospects, deals and money, and where owners see their calls, leads and bookings.
- **Character.** Calm, exact, shop-floor practical.
- **World.** The contractor's office and the job truck: work orders, job tickets with numbers, a dispatch board, kraft and espresso. Light mode is the office in daylight; dark mode is the shop at night.
- **Neutrals.** Keep the portal's warm near-neutral ramp (`#FAF8F5` page, `#FFFFFF` card, `#14110F` dark page): it reads as paper, not as a colour. Three text roles. No new tint.
- **Accent.** The existing brand burnt orange (`#D9662A`, text `#A8461A`/`#E07A3F`) as the single accent: the selection, the current period, the one key figure. It leaves the sidebar block.
- **Type.** Inter for the interface (kept: it is the brand's choice and fits "exact"); Geist Mono (already loaded) for tickets: IDs, phone numbers, dates, counts. Weights 400 and 500.
- **Moments.** (1) The Today sentence and its four numbers. (2) The one main chart per data screen: months in neutral steps, the current month in the accent. (3) The Clients board as a dispatch board of tickets.
- **Signature.** The ticket stub: a quiet mono, tabular, muted meta line for IDs, phone numbers, dates and counts, with a hairline tear-off rule above row meta in boards and lists. Used on meta only, nowhere else.
- **Guardrails.** Features, routes, data flows, test IDs, 4–6 sidebar areas with horizontal sub-tabs and one h1 per area page stay. Presentation, copy and spacing only.

## Pass plan (one pass and one area per commit)
1. Spacing: shared page frame, one stat tile, 4px scale, 2-up tiles on phones.
2. Color: quiet active nav, accent-only-where-it-means-something in charts.
3. Icons: verify one set, one size, one stroke.
4. Copy: subheads without periods, comparisons on stat tiles, short dates.
5. Type: weights 400/500, one scale, mono tickets, no uppercase label.
6. Layout: Prospecting funnel + overview merged under one idea, client dashboard grid rhythm.
7. Details: nested radii, ticket meta, chart hierarchy (one main chart, lists with thin bars for the rest).
8. Visuals: product-native only; no images, no new providers.
9. Motion: `transition-all` replaced by named properties, one easing curve, skeletons only.
