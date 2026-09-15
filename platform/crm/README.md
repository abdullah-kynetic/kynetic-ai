# Kynetic OS

Multi-tenant client portal + admin console for Kynetic's AI-receptionist agency clients.

## Client Portal (`/portal/[clientId]/...`)

What each client logs into:

- `dashboard` — calls answered, jobs booked, revenue recovered, missed calls avoided this month
- `calls` — call log + upcoming Cal.com bookings
- `reviews` — reviews requested/received, current Google rating, before/after
- `leads` — follow-up pipeline for callers/form-fills who haven't booked yet
- `reports` — current monthly report + archive of past months

## Admin (`/admin/...`)

What only Kynetic sees. Deliberately narrow — internal ops (offer, sales pipeline, build
tracker) stays in Notion, not duplicated here.

- `clients` — every client, status, MRR, contract start
- `clients/[id]` — the same 5 client pages, viewable for any client
- `health` — is each client's receptionist / review automation / nurture sequence actually running
- `billing` — Stripe status per client

## Data

Postgres (Neon), raw SQL via `@neondatabase/serverless`, no ORM. Tables (`clients`, `calls`,
`bookings`, `followups`, `monthly_reports`) are created and seeded with mock data lazily on
first request — no migration step needed.

## Local development

```bash
cp .env.local.example .env.local   # fill in DATABASE_URL
npm install
npm run dev
```

## Not built yet

- Auth (client + admin, Google OAuth) — currently anyone with a URL can view any client
- Real integrations: Retell (calls), Cal.com (bookings), Google (reviews), Stripe (billing) —
  all mock data for now
- Front-end design skill pass
- Explicit mobile-optimization pass
