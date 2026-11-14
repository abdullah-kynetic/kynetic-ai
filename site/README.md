# kyneticai.com (Astro)

The kyneticai.com site. Static Astro output with no framework on the client; deployed to Cloudflare Pages (project kyneticai-preview).

- `npm run build` builds to `dist/`; `npm run preview` serves it.
- `src/scripts/home-motion.ts` is the home page motion (CSS transitions, one IntersectionObserver, one small canvas, no libraries). `audit-lazy.ts` loads the application overlay (`audit-modal.ts`) on idle or first reach. Fonts are self-hosted in `public/fonts/`.
- `npm test` runs the functional and content tests (Playwright; needs a preview server on port 4321).
- The contact form posts to the n8n workflow "Website | Contact Form to Twenty" (`https://n8n.kyneticai.com/webhook/website-contact`). Override with `PUBLIC_CONTACT_WEBHOOK` at build time. The workflow stays inactive until switched on in n8n.
- `/audit` (internal sales-call tool) is not in the public build. Build it locally with `INCLUDE_AUDIT=1 npm run build` (or `INCLUDE_AUDIT=1 npm run dev`).
- Niche landing pages (`/remodelers`, later Solar & Battery and Foundation Repair) are hidden for now: they are only built with `INCLUDE_NICHES=1`. When built they are generated from `src/niches/`; see `src/niches/README.md`.
