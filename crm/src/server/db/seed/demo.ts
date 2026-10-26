import type postgres from 'postgres';

type Sql = postgres.Sql;

/**
 * Seed tenants are the only tenants a preview or test database may hold. A preview refuses to
 * start if it finds any other slug (TESTING "Preview environment"). `demo-sales` is the sales demo
 * (F-88); production gets no other seed tenant.
 */
export const SEED_TENANT_SLUGS = ['demo-a', 'demo-b', 'demo-sales'] as const;
export type SeedTenantSlug = (typeof SEED_TENANT_SLUGS)[number];

type TenantSpec = {
  slug: SeedTenantSlug;
  name: string;
  plan: 'founding' | 'value';
  tier: 'T1' | 'T2' | 'T3';
  timezone: string;
  area: string;
  modules: { key: string; level?: 'lite' | 'full' }[];
  owner: string;
  staff: string | null;
  contacts: number;
  seed: number;
};

/** All names and businesses are fictional. Emails use the reserved example.test domain. */
const TENANTS: TenantSpec[] = [
  {
    slug: 'demo-a',
    name: 'Ridgeline Roofing (demo)',
    plan: 'founding',
    tier: 'T1',
    timezone: 'America/Los_Angeles',
    area: '206',
    modules: [{ key: 'alex_core' }],
    owner: 'owner-demo-a@example.test',
    staff: 'staff-demo-a@example.test',
    contacts: 12,
    seed: 11
  },
  {
    slug: 'demo-b',
    name: 'Cedar Valley Exteriors (demo)',
    plan: 'value',
    tier: 'T2',
    timezone: 'America/Chicago',
    area: '312',
    modules: [{ key: 'alex_core' }, { key: 'crm', level: 'lite' }],
    owner: 'owner-demo-b@example.test',
    staff: null,
    contacts: 12,
    seed: 23
  },
  {
    slug: 'demo-sales',
    name: 'Summit Home Services (demo)',
    plan: 'founding',
    tier: 'T2',
    timezone: 'America/Denver',
    area: '303',
    modules: [
      { key: 'alex_core' },
      { key: 'quote_followup' },
      { key: 'missed_call_textback' },
      { key: 'crm', level: 'full' }
    ],
    owner: 'owner-demo-sales@example.test',
    staff: 'staff-demo-sales@example.test',
    contacts: 24,
    seed: 37
  }
];

const FIRST = [
  'Avery',
  'Jordan',
  'Morgan',
  'Riley',
  'Casey',
  'Taylor',
  'Quinn',
  'Parker',
  'Rowan',
  'Sage'
];
const LAST = ['Alder', 'Birch', 'Cobb', 'Dunn', 'Ellis', 'Frost', 'Gray', 'Hale', 'Ives', 'Lane'];
const SERVICES = [
  'Roof replacement',
  'Roof repair',
  'Storm damage',
  'Gutter install',
  'Inspection'
];
const SOURCES = ['meta_ads', 'google_ads', 'referral', 'website'];
const STAGES = [
  ['New', 5, false, false],
  ['Contacted', 15, false, false],
  ['Qualified', 30, false, false],
  ['Estimate Booked', 45, false, false],
  ['Estimate Done', 60, false, false],
  ['Quoted', 70, false, false],
  ['Won', 100, true, false],
  ['Lost', 0, false, true]
] as const;

/** Small deterministic PRNG so a reseed produces the same data. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fictional NANP number in the reserved 555-0100 to 555-0199 range. */
export function syntheticPhone(area: string, n: number): string {
  return `+1${area}55501${String(n % 100).padStart(2, '0')}`;
}

export type SeedResult = { slug: SeedTenantSlug; status: 'created' | 'skipped' };

/**
 * Inserts the synthetic demo tenants. Idempotent: a tenant whose slug already exists is
 * left untouched, and a second run changes nothing. Tenant tables use FORCE row-level security, so
 * `sql` must be a connection that bypasses it (a superuser or BYPASSRLS role in dev, test and
 * preview). The reference rows (module catalog, prices, templates) come from migration 0012.
 */
export async function seedDemoTenants(sql: Sql, opts: { now?: Date } = {}): Promise<SeedResult[]> {
  const now = opts.now ?? new Date();
  const results: SeedResult[] = [];
  for (const spec of TENANTS) {
    const exists = await sql`select 1 from tenants where slug = ${spec.slug}`;
    if (exists.length > 0) {
      results.push({ slug: spec.slug, status: 'skipped' });
      continue;
    }
    await sql.begin((tx) => seedTenant(tx as unknown as Sql, spec, now));
    results.push({ slug: spec.slug, status: 'created' });
  }
  return results;
}

async function seedTenant(sql: Sql, spec: TenantSpec, now: Date): Promise<void> {
  const rand = rng(spec.seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const daysAgo = (d: number, hour = 10) =>
    new Date(now.getTime() - d * 86_400_000 + hour * 3_600_000 - now.getUTCHours() * 3_600_000);

  const [tenant] =
    await sql`insert into tenants (slug, name, status, plan, pricing_tier, timezone, avg_job_value_cents, go_live_at)
    values (${spec.slug}, ${spec.name}, 'active', ${spec.plan}, ${spec.tier}, ${spec.timezone}, 1200000, ${daysAgo(60)})
    returning id`;
  const t = tenant!.id as string;

  const userIds: Record<string, string> = {};
  for (const [email, name, role] of [
    [spec.owner, 'Demo Owner', 'owner'],
    ...(spec.staff ? [[spec.staff, 'Demo Staff', 'staff']] : [])
  ] as const) {
    const [u] = await sql`insert into users (email, name) values (${email}, ${name})
      on conflict (email) do update set name = excluded.name returning id`;
    userIds[role] = u!.id as string;
    await sql`insert into memberships (tenant_id, user_id, role) values (${t}, ${u!.id}, ${role})`;
  }

  await sql`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${t}, 'platform', true, '')`;
  for (const m of spec.modules)
    await sql`insert into tenant_modules (tenant_id, module_key, enabled, level)
      values (${t}, ${m.key}, true, ${m.level ?? ''})`;
  await sql`insert into alex_configs (tenant_id, provider, paused) values (${t}, 'fake', false)`;

  const [pipeline] =
    await sql`insert into pipelines (tenant_id, name, is_default) values (${t}, 'Sales', true) returning id`;
  const stageIds: string[] = [];
  for (const [i, [name, probability, isWon, isLost]] of STAGES.entries()) {
    const [s] =
      await sql`insert into pipeline_stages (tenant_id, pipeline_id, name, position, probability, is_won, is_lost)
      values (${t}, ${pipeline!.id}, ${name}, ${i}, ${probability}, ${isWon}, ${isLost}) returning id`;
    stageIds.push(s!.id as string);
  }

  for (let i = 0; i < spec.contacts; i++) {
    const first = FIRST[i % FIRST.length]!;
    const last = pick(LAST);
    const phone = syntheticPhone(spec.area, i + 1);
    const created = daysAgo(Math.floor(rand() * 55) + 1);
    const stageIdx = Math.floor(rand() * STAGES.length);
    const stage = STAGES[stageIdx]!;
    const [contact] =
      await sql`insert into contacts (tenant_id, first_name, last_name, primary_phone_e164, primary_email, phones, emails, source, status, owner_id, created_at, updated_at)
      values (${t}, ${first}, ${last}, ${phone}, ${`${first}.${last}.${i}@example.test`.toLowerCase()}, ${[phone]}, ${[`${first}.${last}.${i}@example.test`.toLowerCase()]},
        ${pick(SOURCES)}, ${stage[3] ? 'lost' : stage[2] ? 'won' : stageIdx >= 3 ? 'booked' : 'working'}, ${userIds.owner!}, ${created}, ${created})
      returning id`;
    const contactId = contact!.id as string;

    const [deal] =
      await sql`insert into deals (tenant_id, pipeline_id, stage_id, title, value_cents, service_type, source, owner_id, position, won_at, lost_at, lost_reason, created_at, updated_at)
      values (${t}, ${pipeline!.id}, ${stageIds[stageIdx]!}, ${`${pick(SERVICES)} - ${last}`}, ${(Math.floor(rand() * 20) + 4) * 100_000},
        ${pick(SERVICES)}, ${pick(SOURCES)}, ${userIds.owner!}, ${`a${String(i).padStart(3, '0')}`},
        ${stage[2] ? created : null}, ${stage[3] ? created : null}, ${stage[3] ? 'Went with another contractor' : null}, ${created}, ${created})
      returning id`;
    await sql`insert into deal_contacts (tenant_id, deal_id, contact_id, role) values (${t}, ${deal!.id}, ${contactId}, 'homeowner')`;

    const callAt = new Date(created.getTime() + 45_000);
    await sql`insert into calls (tenant_id, contact_id, deal_id, provider, provider_call_id, direction, started_at, ended_at, duration_s, outcome, sentiment)
      values (${t}, ${contactId}, ${deal!.id}, 'fake', ${`${spec.slug}-call-${i}`}, 'outbound', ${callAt}, ${new Date(callAt.getTime() + 95_000)}, 95,
        ${stageIdx >= 3 ? 'booked' : 'no_answer'}, ${stageIdx >= 3 ? 'positive' : 'unknown'})`;
    if (stageIdx >= 3 && stageIdx <= 5) {
      const start = new Date(now.getTime() + (stageIdx - 3 + 1) * 86_400_000);
      await sql`insert into appointments (tenant_id, contact_id, deal_id, starts_at, ends_at, booked_by)
        values (${t}, ${contactId}, ${deal!.id}, ${start}, ${new Date(start.getTime() + 3_600_000)}, 'alex')`;
    }
  }
}
