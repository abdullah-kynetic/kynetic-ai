# kyneticai.com (Astro)

Rebuild of the Framer site. Static output, no deploy configured yet.

- `npm run build` builds to `dist/`; `npm run preview` serves it.
- `node scripts/snapshot.mjs` re-reads the live site into `src/snapshot/` and `public/assets/`.
- `src/scripts/` holds the motion and interactions (see `main.ts`).
- `node tests/visual/diff.mjs` compares the build with the live site by pixels; `tests/capture/` holds the live-site recorders.
- Set `PUBLIC_CONTACT_WEBHOOK` at build time to the n8n webhook URL for the contact form.
