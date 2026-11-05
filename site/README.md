# kyneticai.com (Astro)

Rebuild of the Framer site. Static output, no deploy configured yet.

- `npm run build` builds to `dist/`; `npm run preview` serves it.
- `node scripts/snapshot.mjs` re-reads the live site into `src/snapshot/` and `public/assets/`.
- `src/scripts/` holds the motion and interactions (see `main.ts`).
- `node tests/visual/diff.mjs` compares the build with the live site by pixels; `tests/capture/` holds the live-site recorders.
- The contact form posts to the n8n workflow "Website | Contact Form to Twenty" (`https://n8n.kyneticai.com/webhook/website-contact`). Override with `PUBLIC_CONTACT_WEBHOOK` at build time. The workflow stays inactive until switched on in n8n.
- `/audit` (internal sales-call tool) is not in the public build. Build it locally with `INCLUDE_AUDIT=1 npm run build` (or `INCLUDE_AUDIT=1 npm run dev`).
- Niche landing pages (`/remodelers`, later Solar & Battery and Foundation Repair) are generated from `src/niches/`; see `src/niches/README.md`.
