# Kynetic Dispatch

Internal admin console for Kynetic's AI-receptionist agency clients. Ported from the
"Kynetic Dispatch" claude.ai artifact (proof-of-concept) into a real Next.js app,
following the step-by-step build plan: one feature per step, mock data first, verify
before moving on.

## Pages

- `/clients` — every client account, status, plan, calls/mo, revenue recovered
- `/clients/[id]/calls` — that client's call log + answer rate + conversion rate
- `/clients/[id]/bookings` — that client's upcoming jobs
- `/clients/[id]/analytics` — that client's KPIs and before/after answer-rate chart

Not yet built (tracked as the next steps): System Health, Billing, real Postgres data,
real client import, Clerk admin auth.

## Local development

```bash
npm install
npm run dev
```

Currently runs entirely on mock data in `src/lib/mock.ts` — no database connection
required yet.
