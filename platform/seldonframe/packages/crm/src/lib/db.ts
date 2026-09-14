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

const MOCK_LEADS: Array<{
  name: string;
  company: string;
  email: string;
  phone: string;
  value: number;
  stage: string;
}> = [
  { name: "Maria Chen", company: "Brightleaf Roofing", email: "maria@brightleafroofing.com", phone: "555-0101", value: 8200, stage: "new" },
  { name: "Devon Marsh", company: "Marsh & Co Landscaping", email: "devon@marshlandscaping.com", phone: "555-0102", value: 4500, stage: "contacted" },
  { name: "Priya Nair", company: "Nair Dental Group", email: "priya@nairdental.com", phone: "555-0103", value: 12000, stage: "qualified" },
  { name: "Tom Alvarez", company: "Alvarez HVAC", email: "tom@alvarezhvac.com", phone: "555-0104", value: 6300, stage: "new" },
  { name: "Kelsey Wu", company: "Wu Family Law", email: "kelsey@wufamilylaw.com", phone: "555-0105", value: 9800, stage: "proposal" },
  { name: "Sam Okafor", company: "Okafor Plumbing", email: "sam@okaforplumbing.com", phone: "555-0106", value: 3100, stage: "contacted" },
  { name: "Grace Lindqvist", company: "Lindqvist Dermatology", email: "grace@lindqvistderm.com", phone: "555-0107", value: 15500, stage: "won" },
  { name: "Ben Ortega", company: "Ortega Auto Body", email: "ben@ortegaautobody.com", phone: "555-0108", value: 5400, stage: "qualified" },
  { name: "Nina Petrova", company: "Petrova Pilates Studio", email: "nina@petrovapilates.com", phone: "555-0109", value: 2200, stage: "new" },
  { name: "Marcus Webb", company: "Webb Electrical Services", email: "marcus@webbelectrical.com", phone: "555-0110", value: 7600, stage: "proposal" },
  { name: "Aisha Rahman", company: "Rahman Orthodontics", email: "aisha@rahmanortho.com", phone: "555-0111", value: 18300, stage: "won" },
  { name: "Chris Doyle", company: "Doyle Pest Control", email: "chris@doylepest.com", phone: "555-0112", value: 2900, stage: "lost" },
  { name: "Layla Hassan", company: "Hassan Interiors", email: "layla@hassaninteriors.com", phone: "555-0113", value: 11000, stage: "contacted" },
  { name: "Owen Fitzgerald", company: "Fitzgerald Flooring", email: "owen@fitzgeraldflooring.com", phone: "555-0114", value: 4800, stage: "new" },
  { name: "Yuki Tanaka", company: "Tanaka Sushi Catering", email: "yuki@tanakacatering.com", phone: "555-0115", value: 3600, stage: "qualified" },
  { name: "Rosa Delgado", company: "Delgado Cleaning Co", email: "rosa@delgadocleaning.com", phone: "555-0116", value: 1900, stage: "lost" },
  { name: "Hank Sullivan", company: "Sullivan Concrete", email: "hank@sullivanconcrete.com", phone: "555-0117", value: 22000, stage: "proposal" },
  { name: "Ivy Chapman", company: "Chapman Veterinary", email: "ivy@chapmanvet.com", phone: "555-0118", value: 9200, stage: "won" },
];

async function bootstrap() {
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      value INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM leads`;
  if (count === 0) {
    for (const lead of MOCK_LEADS) {
      await sql`
        INSERT INTO leads (name, company, email, phone, value, stage)
        VALUES (${lead.name}, ${lead.company}, ${lead.email}, ${lead.phone}, ${lead.value}, ${lead.stage})
      `;
    }
  }
}

export function ensureReady() {
  if (!ready) ready = bootstrap();
  return ready;
}
