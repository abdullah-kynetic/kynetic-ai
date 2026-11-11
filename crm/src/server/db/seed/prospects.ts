import type postgres from 'postgres';
import { DEMO_CLIENT_PROFILES } from './demo-client-profiles';

type Sql = postgres.Sql;

/**
 * Thirteen real Texas businesses, set up as ordinary client workspaces. Everything here is public
 * information (their own sites and listings, the public Meta Ad Library and public review pages,
 * checked 2026-11-02). Nothing is invented: no leads, calls, reviews or revenue, no personal
 * numbers, and no owner names where a source was missing or disputed. The portal shows them with
 * their real business details and empty activity until each one signs up. Outreach is phone only,
 * by a human (D-007). Never dial AM-1 Roofing.
 */
export type Prospect = {
  slug: string;
  name: string;
  niche: 'roofing' | 'remodeling' | 'pools' | 'windows_doors';
  city: string;
  state: 'TX';
  address?: string;
  phone?: string; // E.164, published business line
  website?: string;
  adCount: number; // active Meta ads seen in the Ad Library scan
  facts: string[]; // short source-backed notes
  review?: { source: string; count: number; rating: number };
};

const SERVICES: Record<Prospect['niche'], string[]> = {
  roofing: ['Roof replacement', 'Roof repair', 'Storm damage', 'Inspection'],
  remodeling: ['Kitchen remodel', 'Bath remodel', 'Cabinetry'],
  pools: ['Custom pool build', 'Pool remodel', 'Outdoor living'],
  windows_doors: ['Window replacement', 'Door replacement']
};

export const PROSPECTS: Prospect[] = [
  {
    slug: 'super-roofer',
    name: 'Super Roofer LLC',
    niche: 'roofing',
    city: 'Houston',
    state: 'TX',
    phone: '+18327079085',
    website: 'https://mysuperroofer.com',
    adCount: 8,
    facts: ['Houston, TX 77060 (Greenspoint) per Yelp listing', 'Facebook: superrooferhtx']
  },
  {
    slug: 'dr-roofing-construction',
    name: 'DR Roofing & Construction',
    niche: 'roofing',
    city: 'Houston',
    state: 'TX',
    address: '18316 State Highway 249, Houston, TX 77070',
    phone: '+12818152422',
    website: 'https://drroofingandconstruction.com',
    adCount: 15,
    facts: [
      'Roofing and remodeling, Greater Houston',
      'Owens Corning contractor profile 4.8 stars'
    ],
    review: { source: 'Owens Corning', count: 426, rating: 4.8 }
  },
  {
    slug: 'fairclaims-roofing',
    name: 'FairClaims Roofing & Construction',
    niche: 'roofing',
    city: 'Spring',
    state: 'TX',
    phone: '+12813670466',
    website: 'https://fairclaimsroofingcompany.com',
    adCount: 4,
    facts: ['Based in The Woodlands area, serving Greater Houston since 2002 (own Facebook page)']
  },
  {
    slug: 'fortbend-roofing-texas',
    name: 'Fortbend Roofing Texas',
    niche: 'roofing',
    city: 'Houston',
    state: 'TX',
    website: 'https://fortbendroofingtx.com',
    adCount: 8,
    facts: ['Greater Houston; no public phone found yet']
  },
  {
    slug: 'rodriguez-roofing',
    name: 'Rodriguez Roofing',
    niche: 'roofing',
    city: 'Houston',
    state: 'TX',
    website: 'https://rodriguezroof.com',
    adCount: 3,
    facts: ['Third-generation family firm serving Houston since 1963 (own ad copy)']
  },
  {
    slug: 'bluewater-pools',
    name: 'BlueWater Pools, LLC',
    niche: 'pools',
    city: 'Crowley',
    state: 'TX',
    address: '10424 FM 1902, Crowley, TX',
    phone: '+18172977120',
    website: 'https://bluewatercustompools.com',
    adCount: 8,
    facts: ['Family-owned, 25+ years (own site)']
  },
  {
    slug: 'tidal-wave-custom-pools',
    name: 'Tidal Wave Custom Pools',
    niche: 'pools',
    city: 'Frisco',
    state: 'TX',
    phone: '+12149068991',
    website: 'https://tidalwavecustompools.com',
    adCount: 7,
    facts: ['Gunite pool builder across DFW (own site)']
  },
  {
    slug: 'kelley-pools-outdoor',
    name: 'Kelley Pools and Outdoor',
    niche: 'pools',
    city: 'Van Alstyne',
    state: 'TX',
    phone: '+19038182019',
    website: 'https://www.kelleypoolsandoutdoor.com',
    adCount: 3,
    facts: ['Veteran-owned small business serving North Texas (own site)']
  },
  {
    slug: 'clarity-windows-doors',
    name: 'Clarity Windows And Doors',
    niche: 'windows_doors',
    city: 'Coppell',
    state: 'TX',
    address: '800 Freeport Pkwy Suite 150, Coppell, TX',
    phone: '+19723933991',
    adCount: 22,
    facts: ['Facebook rating 4.8 from 44 reviews'],
    review: { source: 'Yelp', count: 31, rating: 4.5 }
  },
  {
    slug: 'bridgewood-windows-doors',
    name: 'Bridgewood Windows & Doors',
    niche: 'windows_doors',
    city: 'Allen',
    state: 'TX',
    address: '1333 W. McDermott Dr Suite 275, Allen, TX',
    phone: '+12143809628',
    adCount: 5,
    facts: ['Public business listing']
  },
  {
    slug: 'kitchens-alive',
    name: 'Kitchens Alive LLC',
    niche: 'remodeling',
    city: 'McKinney',
    state: 'TX',
    phone: '+12147890146',
    adCount: 10,
    facts: ['Kitchen, bath and cabinetry remodeler (Angi listing)']
  },
  {
    slug: 'manta-construction',
    name: 'Manta Construction Company',
    niche: 'remodeling',
    city: 'Coppell',
    state: 'TX',
    adCount: 8,
    facts: ['BBB listing in Coppell is under general contractor; phone not confirmed']
  },
  {
    slug: '123-remodeling',
    name: '123 Remodeling',
    niche: 'remodeling',
    city: 'Farmers Branch',
    state: 'TX',
    address: '12100 Ford Rd B148, Farmers Branch, TX',
    phone: '+14699495775',
    adCount: 12,
    facts: [
      'Address from Yelp; a second McKinney address also appears, so confirm before pitching'
    ],
    review: { source: 'Yelp', count: 3, rating: 5.0 }
  }
];

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

export type ProspectSeedResult = { slug: string; status: 'created' | 'skipped' };

/** Idempotent: an existing slug is left untouched. `sql` must bypass row-level security. */
export async function seedProspectTenants(
  sql: Sql,
  opts: { now?: Date } = {}
): Promise<ProspectSeedResult[]> {
  const now = opts.now ?? new Date();
  const results: ProspectSeedResult[] = [];
  for (const p of PROSPECTS) {
    const exists = await sql`select 1 from tenants where slug = ${p.slug}`;
    if (exists.length > 0) {
      results.push({ slug: p.slug, status: 'skipped' });
      continue;
    }
    await sql.begin((tx) => seedOne(tx as unknown as Sql, p, now));
    results.push({ slug: p.slug, status: 'created' });
  }
  return results;
}

async function seedOne(sql: Sql, p: Prospect, now: Date): Promise<void> {
  const tenantId = DEMO_CLIENT_PROFILES.find((client) => client.slug === p.slug)?.tenantId;
  if (!tenantId) throw new Error(`Missing fixed tenant id for prospect ${p.slug}`);
  const [tenant] =
    await sql`insert into tenants (id, slug, name, status, plan, timezone, services, service_area, transfer_number_e164)
    values (${tenantId}, ${p.slug}, ${p.name}, 'onboarding', 'founding', 'America/Chicago',
      ${sql.json(SERVICES[p.niche])}, ${sql.json({ city: p.city, state: p.state })}, ${p.phone ?? null})
    returning id`;
  const t = tenant!.id as string;
  await sql`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${t}, 'platform', true, '')`;
  await sql`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${t}, 'alex_core', true, '')`;
  await sql`insert into alex_configs (tenant_id, provider, paused) values (${t}, 'fake', true)`;
  const [pipeline] =
    await sql`insert into pipelines (tenant_id, name, is_default) values (${t}, 'Sales', true) returning id`;
  for (const [i, [name, probability, isWon, isLost]] of STAGES.entries())
    await sql`insert into pipeline_stages (tenant_id, pipeline_id, name, position, probability, is_won, is_lost)
      values (${t}, ${pipeline!.id}, ${name}, ${i}, ${probability}, ${isWon}, ${isLost})`;
  await sql`insert into companies (tenant_id, name, phone_e164, website, address, custom)
    values (${t}, ${p.name}, ${p.phone ?? null}, ${p.website ?? null},
      ${sql.json({ line1: p.address ?? null, city: p.city, state: p.state })},
      ${sql.json({ niche: p.niche, meta_ads_active: p.adCount, ad_library_checked_on: now.toISOString().slice(0, 10), public_notes: p.facts })})`;
  if (p.review)
    await sql`insert into review_snapshots (tenant_id, source, captured_on, review_count, average_rating)
      values (${t}, ${p.review.source}, ${now.toISOString().slice(0, 10)}, ${p.review.count}, ${p.review.rating})`;
}
