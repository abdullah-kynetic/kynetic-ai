# Niche pages

One file per industry. Each file in this folder (except those starting with `_`) becomes a page at `/<slug>`,
built by `src/pages/[niche].astro` and rendered by `src/layouts/NichePage.astro`.

## Add a niche (for example Solar & Battery or Foundation Repair)

1. Copy `remodelers.ts` to `solar-battery.ts` (or `foundation-repair.ts`).
2. Change `slug`, the meta fields and every piece of copy. The shape is typed in `_types.ts`.
3. Keep `draft: true` until every TODO is resolved. A draft page is `noindex` and left out of the sitemap.
4. On the homepage, change that industry's card in the Industries section from "Coming soon" to a link
   (`src/snapshot/index.body.html`, section `id="industries"`).
5. `npm run build`, then check `/<slug>` on desktop and at phone width.

## Rules for the copy

- Do not invent stats, clients, reviews or results. Use the `proof` placeholders and a `todo` line.
- Only mark a system "Live" when it is. Add-ons carry the plain "Add-on" badge until confirmed.
- Guarantee wording is Abdullah's to approve: keep it as a draft with a visible TODO.
- The booking link is the shared Cal link in `NichePage.astro`.

## TODO markers

Any `todo` string renders as a red dashed box on the page. They are there so the preview cannot be mistaken for finished copy.
Remove the box by clearing the field once the item is resolved.
