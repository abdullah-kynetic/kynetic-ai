import { neon } from "@neondatabase/serverless";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;

function getClient() {
  if (!client) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set — connect a Postgres database in Vercel first.");
    }
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sql = ((...args: any[]) => getClient()(...args)) as (
  strings: TemplateStringsArray,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...values: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<any[]>;

let ready: Promise<void> | null = null;

async function bootstrap() {
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL DEFAULT '',
      mrr INTEGER NOT NULL DEFAULT 0,
      contract_start DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT NOT NULL DEFAULT 'active',
      stripe_status TEXT NOT NULL DEFAULT 'paid',
      receptionist_status TEXT NOT NULL DEFAULT 'running',
      review_automation_status TEXT NOT NULL DEFAULT 'running',
      nurture_status TEXT NOT NULL DEFAULT 'running',
      google_rating_before NUMERIC NOT NULL DEFAULT 0,
      google_rating_now NUMERIC NOT NULL DEFAULT 0,
      reviews_requested INTEGER NOT NULL DEFAULT 0,
      reviews_received INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS calls (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      caller_name TEXT NOT NULL,
      caller_phone TEXT NOT NULL DEFAULT '',
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      outcome TEXT NOT NULL DEFAULT 'inquiry',
      booked BOOLEAN NOT NULL DEFAULT false
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      service TEXT NOT NULL DEFAULT '',
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS followups (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'call',
      stage TEXT NOT NULL DEFAULT 'new',
      last_contact_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS monthly_reports (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      calls_answered INTEGER NOT NULL DEFAULT 0,
      jobs_booked INTEGER NOT NULL DEFAULT 0,
      revenue_recovered INTEGER NOT NULL DEFAULT 0,
      missed_calls_saved INTEGER NOT NULL DEFAULT 0,
      reviews_gained INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT ''
    )
  `;

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM clients`;
  if (count === 0) await seed();
}

async function seed() {
  const clients = [
    { name: "Brightleaf Roofing", industry: "Roofing", mrr: 1500, status: "active", stripe: "paid", recep: "running", rev: "running", nurt: "running", ratingBefore: 3.9, ratingNow: 4.6, reqd: 42, recvd: 31 },
    { name: "Marsh & Co Landscaping", industry: "Landscaping", mrr: 1200, status: "active", stripe: "paid", recep: "running", rev: "running", nurt: "degraded", ratingBefore: 4.1, ratingNow: 4.4, reqd: 28, recvd: 19 },
    { name: "Alvarez HVAC", industry: "HVAC", mrr: 1800, status: "active", stripe: "overdue", recep: "running", rev: "down", nurt: "running", ratingBefore: 3.6, ratingNow: 4.3, reqd: 51, recvd: 33 },
    { name: "Okafor Plumbing", industry: "Plumbing", mrr: 1200, status: "active", stripe: "paid", recep: "degraded", rev: "running", nurt: "running", ratingBefore: 4.0, ratingNow: 4.7, reqd: 35, recvd: 29 },
    { name: "Sullivan Concrete", industry: "Concrete", mrr: 2000, status: "paused", stripe: "canceled", recep: "down", rev: "down", nurt: "down", ratingBefore: 3.8, ratingNow: 3.9, reqd: 12, recvd: 6 },
  ];

  const clientIds: number[] = [];
  for (const c of clients) {
    const [row] = await sql`
      INSERT INTO clients (name, industry, mrr, status, stripe_status, receptionist_status, review_automation_status, nurture_status, google_rating_before, google_rating_now, reviews_requested, reviews_received)
      VALUES (${c.name}, ${c.industry}, ${c.mrr}, ${c.status}, ${c.stripe}, ${c.recep}, ${c.rev}, ${c.nurt}, ${c.ratingBefore}, ${c.ratingNow}, ${c.reqd}, ${c.recvd})
      RETURNING id
    `;
    clientIds.push(row.id as number);
  }

  const outcomes = ["booked", "missed_call_saved", "inquiry", "voicemail"];
  const names = ["Maria Chen", "Devon Marsh", "Priya Nair", "Tom Alvarez", "Kelsey Wu", "Sam Okafor", "Grace Lindqvist", "Ben Ortega", "Nina Petrova", "Marcus Webb"];
  const stages = ["new", "contacted", "nurture_1", "nurture_2", "booked", "lost"];

  for (const clientId of clientIds) {
    for (let i = 0; i < 14; i++) {
      const outcome = outcomes[i % outcomes.length];
      const daysAgo = i * 2 + 1;
      await sql`
        INSERT INTO calls (client_id, caller_name, caller_phone, occurred_at, outcome, booked)
        VALUES (${clientId}, ${names[i % names.length]}, ${"555-01" + (10 + i)}, now() - (${daysAgo} || ' days')::interval, ${outcome}, ${outcome === "booked"})
      `;
    }

    for (let i = 0; i < 6; i++) {
      const daysAhead = i * 3 + 1;
      await sql`
        INSERT INTO bookings (client_id, customer_name, service, scheduled_at, status)
        VALUES (${clientId}, ${names[(i + 3) % names.length]}, 'Service call', now() + (${daysAhead} || ' days')::interval, 'upcoming')
      `;
    }

    for (let i = 0; i < 8; i++) {
      await sql`
        INSERT INTO followups (client_id, name, phone, source, stage, last_contact_at)
        VALUES (${clientId}, ${names[(i + 5) % names.length]}, ${"555-02" + (10 + i)}, ${i % 2 === 0 ? "call" : "form"}, ${stages[i % stages.length]}, now() - (${i} || ' days')::interval)
      `;
    }

    const months = ["2026-06", "2026-07", "2026-08"];
    for (const month of months) {
      await sql`
        INSERT INTO monthly_reports (client_id, month, calls_answered, jobs_booked, revenue_recovered, missed_calls_saved, reviews_gained, summary)
        VALUES (${clientId}, ${month}, ${40 + Math.floor(Math.random() * 30)}, ${8 + Math.floor(Math.random() * 10)}, ${4000 + Math.floor(Math.random() * 6000)}, ${5 + Math.floor(Math.random() * 8)}, ${3 + Math.floor(Math.random() * 6)}, 'Strong month — steady call volume, follow-up sequence converting well.')
      `;
    }
  }
}

export function ensureReady() {
  if (!ready) ready = bootstrap();
  return ready;
}
