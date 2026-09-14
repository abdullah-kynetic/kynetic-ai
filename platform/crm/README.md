# Kynetic CRM

A lightweight CRM: leads, a drag-and-drop pipeline, and live analytics.
Next.js App Router + Tailwind, data stored in Postgres (Neon).

## Pages

- `/leads` — table view, add/edit stage/delete, deal value.
- `/pipeline` — kanban board, drag a card to change its stage.
- `/analytics` — lead counts and pipeline value by stage, win rate.

## Local development

```bash
cp .env.local.example .env.local   # fill in DATABASE_URL
npm install
npm run dev
```

The `leads` table is created automatically (with mock data) on first request —
no migration step needed.

## Deployment

Deployed on Vercel, connected to a free-tier Neon Postgres database via
Vercel's Storage integration (`DATABASE_URL` is auto-injected as an
environment variable). No other setup required.

## Next steps (not built yet)

- Auth (Google OAuth or magic-link) to restrict access per user.
- CSV import for migrating leads from an existing CRM.
- Email automations (Resend) for stale-lead re-engagement sequences.
