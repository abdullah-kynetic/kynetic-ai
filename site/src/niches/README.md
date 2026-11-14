# Niche pages

One file per industry. Each file in this folder (except those starting with `_`) becomes a page at `/<slug>`,
built by `src/pages/[niche].astro` and rendered by `src/layouts/NichePage.astro`.

## Add a niche (for example Solar & Battery or Foundation Repair)

1. Copy `remodelers.ts` to `solar-battery.ts` (or `foundation-repair.ts`).
2. Change `slug`, the meta fields and every piece of copy. The shape is typed in `_types.ts`.
3. Keep `draft: true` until the page is ready to be found. It only controls `noindex` and the sitemap. Unfinished items are controlled separately, see "Draft items" below.
4. On the homepage, add that industry's card to the Industries section (`src/snapshot/index.body.html`, section `id="industries"`),
   linking to `/<slug>`. The hidden "Solar & Battery" and "Foundation Repair" cards were removed until their pages ship. To restore one, add
   `<li class="kn-card kn-card--soon"><span class="kn-tag">Coming soon</span><h3 class="kn-card__title">Solar &amp; Battery</h3><p class="kn-card__text">Page in progress.</p></li>`
   (same shape for Foundation Repair) and set the list class back to `kn-cards kn-cards--3`.
5. `npm run build`, then check `/<slug>` on desktop and at phone width.

## Rules for the copy

- Do not invent stats, clients, reviews or results. Use the `proof` placeholders and a `todo` line.
- Only mark a system "Live" when it is. Add-ons carry the plain "Add-on" badge until confirmed.
- Guarantee wording is Abdullah's to approve: keep it as a draft with a visible TODO.
- The booking link is the shared Cal link in `NichePage.astro`.

## Draft items

Unfinished items stay in the config but are removed from the page (not just hidden) unless the build sets `PUBLIC_SHOW_DRAFTS=1`
(for example `PUBLIC_SHOW_DRAFTS=1 npm run build`). The flag is off in every normal build, including previews.

- Every `todo` string (red dashed box when shown).
- The founder video block, until `video.embedUrl` is set (then it appears on its own, no flag needed).
- The guarantee block, until `guarantee.approved` is `true` (Abdullah approves the wording).
- Case cards: add real `proof.cases` entries and they replace the honest "builds are underway" line. The `placeholders` render only with the flag.
