import { v5 as uuidv5 } from 'uuid';
import type postgres from 'postgres';

type Sql = postgres.Sql;

/** Every row this seed writes is recorded under this batch, and contacts and deals carry it as `imported_source`. */
import { SHOP_DEMO_TAG } from '../../shop/demo';
export const SHOP_DEMO_BATCH = SHOP_DEMO_TAG;
export const SHOP_DEMO_SLUG = 'aa-auto-body-shop';
const NS = '9f2c1d6e-7b0a-4c58-9a41-6d3f0e5b2a17';
const DAY_MS = 86_400_000;

export type ShopDemoStatus =
  | 'planned'
  | 'seeded'
  | 'already_seeded'
  | 'skipped_missing'
  | 'skipped_module_off';
export type ShopDemoResult = { slug: string; status: ShopDemoStatus; rows: number };
export type ShopDemoOptions = { slug?: string; apply?: boolean; now?: Date };

const id = (key: string) => uuidv5(`${SHOP_DEMO_BATCH}:${key}`, NS);

const SOURCES = [
  'ai_receptionist_call',
  'missed_call_text',
  'website_photo_quote',
  'walk_in',
  'google'
] as const;

const PEOPLE = [
  ['Marisol', 'Gutierrez'],
  ['Derrick', 'Whitfield'],
  ['Priya', 'Natarajan'],
  ['Tyrone', 'Banks'],
  ['Hannah', 'Kowalski'],
  ['Luis', 'Ortega'],
  ['Brenda', 'Pruitt'],
  ['Kenji', 'Watanabe'],
  ['Alicia', 'Mendoza'],
  ['Darnell', 'Hughes'],
  ['Rachel', 'Teague'],
  ['Omar', 'Haddad'],
  ['Joanne', 'Villarreal'],
  ['Calvin', 'Ridley'],
  ['Mei', 'Zhang'],
  ['Travis', 'Boone'],
  ['Lucia', 'Fernandez'],
  ['Gordon', 'Pike'],
  ['Natasha', 'Okafor'],
  ['Raul', 'Santos'],
  ['Beth', 'Ainsworth'],
  ['Andre', 'Lewis'],
  ['Carmen', 'Delgado'],
  ['Wes', 'Calloway']
] as const;

const CARS = [
  [2018, 'Honda', 'Civic'],
  [2020, 'Ford', 'F-150'],
  [2019, 'Toyota', 'Camry'],
  [2016, 'Chevrolet', 'Tahoe'],
  [2021, 'Tesla', 'Model 3'],
  [2017, 'Nissan', 'Altima'],
  [2022, 'Hyundai', 'Elantra'],
  [2015, 'Jeep', 'Grand Cherokee'],
  [2019, 'Kia', 'Sorento'],
  [2014, 'Dodge', 'Ram 1500']
] as const;

const INSURERS = ['State Farm', 'Allstate', 'Progressive', 'GEICO', 'USAA'];
const TECHS = ['Marco', 'Dee', 'Hector'];
const WORK = [
  'Bumper repair',
  'Door dent and repaint',
  'Hail damage',
  'Quarter panel',
  'Hood repaint',
  'Fender replacement',
  'Rear collision repair',
  'Side mirror and panel'
];

// Stage for each of the 24 jobs. Spread so every column of the board has cars.
const STAGE_PLAN = [
  'New lead',
  'New lead',
  'New lead',
  'Quoted',
  'Quoted',
  'Quoted',
  'Quoted',
  'Waiting on insurance',
  'Waiting on insurance',
  'Waiting on insurance',
  'Parts ordered',
  'Parts ordered',
  'In repair and paint',
  'In repair and paint',
  'In repair and paint',
  'Ready for pickup',
  'Ready for pickup',
  'Picked up',
  'Picked up',
  'Picked up',
  'Picked up',
  'Picked up',
  'Lost',
  'Lost'
] as const;

/** Sample reviews with a drafted reply each; stored as `review_site` presence items with a JSON `type: review_reply` in the notes. */
const REVIEWS = [
  [
    'Alicia M.',
    5,
    'Google',
    'They matched the paint perfectly and kept me posted by text the whole time.',
    'Thank you, Alicia! We are glad the color match came out right. See you next time, the AA team.'
  ],
  [
    'Rob T.',
    4,
    'Google',
    'Good work on my bumper. Took two days longer than quoted.',
    'Thanks, Rob. Sorry about the extra two days, a part came in late. We will give you a heads-up sooner next time.'
  ],
  [
    'Dana K.',
    5,
    'Yelp',
    'Fair price and honest about what the insurance would cover.',
    'We appreciate that, Dana. Being straight about the claim matters to us.'
  ],
  [
    'Chris P.',
    2,
    'Google',
    'Paint had a small run near the door handle when I picked it up.',
    'Chris, we are sorry about the run. Please bring it back and we will fix it at no charge. Call us any time.'
  ]
] as const;

const LISTINGS = [
  ['profile', 'Google Business Profile', 'done'],
  ['directory', 'Apple Business Connect', 'planned'],
  ['review_site', 'Yelp', 'needs_attention'],
  ['directory', 'Bing Places', 'planned'],
  ['directory', 'AI assistants (ChatGPT, Gemini, Siri answers)', 'in_progress']
] as const;

const POSTS = [
  'Before and after: a hail-damaged hood repainted in two days.',
  'How a body shop works with your insurance, in four steps.',
  'We will text you when your car is ready. No more calling to ask.'
] as const;

const phone = (n: number) => `+1214555${String(100 + n).padStart(4, '0')}`;

type Plan = {
  contacts: number;
  deals: number;
  calls: number;
  messages: number;
  appointments: number;
  tasks: number;
};
const PLAN: Plan = { contacts: 24, deals: 24, calls: 18, messages: 12, appointments: 10, tasks: 6 };
const plannedRows = () =>
  PLAN.contacts +
  PLAN.deals * 2 +
  PLAN.calls +
  PLAN.messages +
  PLAN.appointments +
  PLAN.tasks +
  9 +
  4 +
  5 +
  5 +
  3 +
  4;

async function ledger(
  sql: Sql,
  tenantId: string,
  table: string,
  recordId: string,
  before?: unknown
) {
  await sql`insert into demo_seed_records (tenant_id, table_name, record_id, seed_batch, before)
    values (${tenantId}, ${table}, ${recordId}, ${SHOP_DEMO_BATCH},
      (${before == null ? null : JSON.stringify(before)}::text)::jsonb)
    on conflict do nothing`;
}

async function findTenant(sql: Sql, slug: string) {
  const [tenant] = await sql`select id from tenants where slug = ${slug}`;
  return (tenant?.id as string | undefined) ?? null;
}

/**
 * Loads sample shop data into one client that already has the `shop_ops` module on. Dry run unless
 * `apply`. Never creates a tenant, a user or a module. Every row is recorded so `removeShopDemo`
 * can delete exactly this batch and nothing else.
 */
export async function seedShopDemo(sql: Sql, opts: ShopDemoOptions = {}): Promise<ShopDemoResult> {
  const slug = opts.slug ?? SHOP_DEMO_SLUG;
  const tenantId = await findTenant(sql, slug);
  if (!tenantId) return { slug, status: 'skipped_missing', rows: 0 };
  const [mod] = await sql`select 1 from tenant_modules
    where tenant_id = ${tenantId} and module_key = 'shop_ops' and enabled`;
  if (!mod) return { slug, status: 'skipped_module_off', rows: 0 };
  const [prior] = await sql`select 1 from demo_seed_records
    where tenant_id = ${tenantId} and seed_batch = ${SHOP_DEMO_BATCH} and table_name = '__seed_meta__'`;
  if (prior) return { slug, status: 'already_seeded', rows: 0 };
  if (!opts.apply) return { slug, status: 'planned', rows: plannedRows() };
  const rows = await sql.begin((tx) =>
    seedTenant(tx as unknown as Sql, tenantId, opts.now ?? new Date())
  );
  return { slug, status: 'seeded', rows };
}

async function seedTenant(sql: Sql, tenantId: string, now: Date): Promise<number> {
  const [admin] =
    await sql`select id from users where kynetic_role = 'admin' and disabled_at is null
    order by created_at limit 1`;
  const [owner] = await sql`select user_id from memberships
    where tenant_id = ${tenantId} and role = 'owner' order by created_at limit 1`;
  const actor = (admin?.id ?? owner?.user_id) as string | undefined;
  if (!actor) throw new Error('no user to act as for the sample data');
  await sql`select set_config('app.tenant_id', ${tenantId}, true), set_config('app.user_id', ${actor}, true),
    set_config('app.role', 'admin', true), set_config('app.read_only', 'off', true)`;
  let count = 0;
  const ownerId = (owner?.user_id as string | undefined) ?? null;
  await ledger(sql, tenantId, '__seed_meta__', id('meta'), { at: now.toISOString() });
  count++;

  const [pipeline] =
    await sql`select id from pipelines where tenant_id = ${tenantId} and is_default limit 1`;
  if (!pipeline)
    throw new Error('the client has no default pipeline; apply the auto body template first');
  const stageRows = await sql`select id, name from pipeline_stages
    where tenant_id = ${tenantId} and pipeline_id = ${pipeline.id}`;
  const stageId = new Map(stageRows.map((s) => [s.name as string, s.id as string]));
  for (const name of new Set(STAGE_PLAN))
    if (!stageId.has(name))
      throw new Error(`stage "${name}" is missing; apply the auto body template first`);

  const daysAgo = (n: number, hour = 15) => {
    const d = new Date(now.getTime() - n * DAY_MS);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };

  const people: { contactId: string; dealId: string; name: string; stage: string }[] = [];
  for (const [i, [first, last]] of PEOPLE.entries()) {
    const contactId = id(`contact:${i}`);
    const dealId = id(`deal:${i}`);
    const stage = STAGE_PLAN[i]!;
    const created = daysAgo(2 + ((i * 3) % 24));
    const source = SOURCES[i % SOURCES.length]!;
    const car = CARS[i % CARS.length]!;
    const insured = i % 3 !== 1;
    // Out-of-pocket tickets run $200 to $6,000; insurance jobs $1,200 to $22,000.
    const valueCents = insured
      ? (1_200 + ((i * 937) % 20_800)) * 100
      : (200 + ((i * 521) % 5_800)) * 100;
    const closed = stage === 'Picked up';
    const custom: Record<string, unknown> = {
      vehicle_year: car[0],
      vehicle_make: car[1],
      vehicle_model: car[2],
      payment_type: insured ? 'Insurance' : 'Out-of-pocket',
      estimate_amount: valueCents,
      drop_off_date: daysAgo(1 + (i % 9))
        .toISOString()
        .slice(0, 10),
      tech: ['In repair and paint', 'Parts ordered', 'Ready for pickup', 'Picked up'].includes(
        stage
      )
        ? TECHS[i % TECHS.length]
        : undefined
    };
    if (insured && stage !== 'New lead' && stage !== 'Lost') {
      custom.insurer = INSURERS[i % INSURERS.length];
      custom.claim_number = `CLM-${4000 + i * 7}`;
    }
    await sql`insert into contacts
      (id, tenant_id, first_name, last_name, primary_phone_e164, phones, emails, source, status,
       owner_id, custom, created_at, updated_at, imported_source, external_id)
      values (${id(`contact:${i}`)}, ${tenantId}, ${first}, ${last}, ${phone(i)}, ${`{${phone(i)}}`}::text[],
        ${'{}'}::text[], ${source}, 'working', ${ownerId}, (${JSON.stringify({ sample: true })}::text)::jsonb,
        ${created.toISOString()}, ${created.toISOString()}, ${SHOP_DEMO_BATCH}, ${`shop-demo-contact-${i}`})`;
    await ledger(sql, tenantId, 'contacts', contactId);
    await sql`insert into deals
      (id, tenant_id, pipeline_id, stage_id, title, value_cents, service_type, source, owner_id,
       position, custom, won_at, lost_at, lost_reason, created_at, updated_at, imported_source, external_id)
      values (${dealId}, ${tenantId}, ${pipeline.id}, ${stageId.get(stage)!},
        ${`${WORK[i % WORK.length]} - ${last}`}, ${valueCents}, ${WORK[i % WORK.length]!}, ${source}, ${ownerId},
        ${`z${String(i).padStart(5, '0')}`}, (${JSON.stringify(custom)}::text)::jsonb,
        ${closed ? daysAgo(1 + (i % 20)).toISOString() : null},
        ${stage === 'Lost' ? daysAgo(3).toISOString() : null}, ${stage === 'Lost' ? 'Went with another shop' : null},
        ${created.toISOString()}, ${created.toISOString()}, ${SHOP_DEMO_BATCH}, ${`shop-demo-deal-${i}`})`;
    await ledger(sql, tenantId, 'deals', dealId);
    await sql`insert into deal_contacts (tenant_id, deal_id, contact_id, role)
      values (${tenantId}, ${dealId}, ${contactId}, 'homeowner')`;
    await ledger(sql, tenantId, 'deal_contacts', id(`link:${i}`), { dealId, contactId });
    count += 3;
    people.push({ contactId, dealId, name: `${first} ${last}`, stage });
  }

  // Reviews and listings: ratings, review requests for picked-up customers, listings and post drafts.
  for (const [i, [source, capturedOn, reviewCount, rating]] of [
    ['Google', daysAgo(30).toISOString().slice(0, 10), 205, 4.7],
    ['Google', now.toISOString().slice(0, 10), 212, 4.8],
    ['Yelp', now.toISOString().slice(0, 10), 38, 4.5],
    ['Facebook', now.toISOString().slice(0, 10), 54, 4.6]
  ].entries()) {
    const snapshotId = id(`review-snapshot:${i}`);
    await sql`insert into review_snapshots (id, tenant_id, source, captured_on, review_count, average_rating)
      values (${snapshotId}, ${tenantId}, ${source as string}, ${capturedOn as string}, ${reviewCount as number}, ${rating as number})`;
    await ledger(sql, tenantId, 'review_snapshots', snapshotId);
    count++;
  }
  const pickedUp = people.filter((q) => q.stage === 'Picked up');
  for (const [i, p] of pickedUp.entries()) {
    const requestId = id(`review-request:${i}`);
    const status = ['completed', 'completed', 'sent', 'completed', 'queued'][i % 5]!;
    await sql`insert into review_requests (id, tenant_id, contact_id, channel, status, requested_at, completed_at)
      values (${requestId}, ${tenantId}, ${p.contactId}, 'sms', ${status}, ${daysAgo(2 + i).toISOString()},
        ${status === 'completed' ? daysAgo(1 + i).toISOString() : null})`;
    await ledger(sql, tenantId, 'review_requests', requestId);
    count++;
  }
  for (const [i, [kind, title, status]] of LISTINGS.entries()) {
    const itemId = id(`listing:${i}`);
    await sql`insert into presence_items (id, tenant_id, kind, title, status, notes)
      values (${itemId}, ${tenantId}, ${kind}, ${title}, ${status}, 'Sample listing.')`;
    await ledger(sql, tenantId, 'presence_items', itemId);
    count++;
  }
  for (const [i, post] of POSTS.entries()) {
    const itemId = id(`post:${i}`);
    await sql`insert into presence_items (id, tenant_id, kind, title, status, notes)
      values (${itemId}, ${tenantId}, 'social_post', ${`Post draft ${i + 1}`}, 'planned', ${post})`;
    await ledger(sql, tenantId, 'presence_items', itemId);
    count++;
  }
  for (const [i, [reviewer, rating, source, text, reply]] of REVIEWS.entries()) {
    const itemId = id(`review-reply:${i}`);
    const notes = JSON.stringify({
      type: 'review_reply',
      reviewer,
      rating,
      source,
      text,
      reply,
      sample: true
    });
    await sql`insert into presence_items (id, tenant_id, kind, title, status, notes)
      values (${itemId}, ${tenantId}, 'review_site', ${`Reply to ${reviewer}`}, 'planned', ${notes})`;
    await ledger(sql, tenantId, 'presence_items', itemId);
    count++;
  }

  const OUTCOMES = ['booked', 'qualified', 'voicemail', 'no_answer', 'other'] as const;
  for (let i = 0; i < PLAN.calls; i++) {
    const p = people[i % people.length]!;
    const callId = id(`call:${i}`);
    const started = daysAgo(i % 9, 9 + (i % 8));
    await sql`insert into calls
      (id, tenant_id, contact_id, deal_id, provider, provider_call_id, direction, started_at, ended_at,
       duration_s, outcome, sentiment, summary, extracted, created_at)
      values (${callId}, ${tenantId}, ${p.contactId}, ${p.dealId}, 'fake', ${`aa-shop-demo-${i}`}, 'inbound',
        ${started.toISOString()}, ${new Date(started.getTime() + 140_000).toISOString()}, 140,
        ${OUTCOMES[i % OUTCOMES.length]!}, 'neutral',
        ${`Sample call: ${p.name} asked about a repair estimate and was offered a drop-off time.`},
        (${JSON.stringify({ sample: true })}::text)::jsonb, ${started.toISOString()})`;
    await ledger(sql, tenantId, 'calls', callId);
    count++;
  }

  for (let i = 0; i < PLAN.messages; i++) {
    const p = people[(i * 2) % people.length]!;
    const messageId = id(`message:${i}`);
    const inbound = i % 3 === 0;
    const at = daysAgo(i % 6, 10 + (i % 6));
    await sql`insert into messages
      (id, tenant_id, contact_id, deal_id, channel, direction, actor_type, from_address, to_address, body,
       status, sent_at, created_at)
      values (${messageId}, ${tenantId}, ${p.contactId}, ${p.dealId}, 'sms', ${inbound ? 'inbound' : 'outbound'},
        ${inbound ? 'system' : 'automation'}, ${inbound ? phone(40) : '+12145550100'},
        ${inbound ? '+12145550100' : phone(40)},
        ${inbound ? 'Sample text: Is my car ready yet?' : 'Sample text: Your estimate is ready to look at.'},
        ${inbound ? 'received' : 'delivered'}, ${at.toISOString()}, ${at.toISOString()})`;
    await ledger(sql, tenantId, 'messages', messageId);
    count++;
  }

  const KINDS = ['drop-off', 'estimate', 'pickup'] as const;
  for (let i = 0; i < PLAN.appointments; i++) {
    const p = people[(i * 2 + 1) % people.length]!;
    const apptId = id(`appointment:${i}`);
    const start = new Date(now.getTime() + (i % 6) * DAY_MS);
    start.setUTCHours(14 + (i % 4), 0, 0, 0);
    await sql`insert into appointments
      (id, tenant_id, contact_id, deal_id, starts_at, ends_at, status, booked_by, notes)
      values (${apptId}, ${tenantId}, ${p.contactId}, ${p.dealId}, ${start.toISOString()},
        ${new Date(start.getTime() + 3_600_000).toISOString()}, 'scheduled', 'alex',
        ${`${KINDS[i % KINDS.length]!}: sample appointment`})`;
    await ledger(sql, tenantId, 'appointments', apptId);
    count++;
  }

  for (let i = 0; i < PLAN.tasks; i++) {
    const p = people[(i * 3) % people.length]!;
    const taskId = id(`task:${i}`);
    await sql`insert into tasks (id, tenant_id, title, contact_id, deal_id, due_at, priority)
      values (${taskId}, ${tenantId}, ${`Sample task: call ${p.name} about the estimate`}, ${p.contactId},
        ${p.dealId}, ${new Date(now.getTime() + (i - 1) * DAY_MS).toISOString()}, 'normal')`;
    await ledger(sql, tenantId, 'tasks', taskId);
    count++;
  }

  // Quote follow-up runs for the Quoted jobs. The automation row is created switched off only when
  // the client has none. Runs wait in the future with no queued job, so nothing sends.
  const [existing] = await sql`select id from automations
    where tenant_id = ${tenantId} and kind = 'template' and template_key = 'quote_followup'`;
  let automationId = existing?.id as string | undefined;
  if (!automationId) {
    automationId = id('automation');
    await sql`insert into automations (id, tenant_id, kind, template_key, name, enabled)
      values (${automationId}, ${tenantId}, 'template', 'quote_followup', 'Quote follow-up', false)`;
    await ledger(sql, tenantId, 'automations', automationId);
    count++;
    for (const [i, [delay, body]] of [
      [0, 'Sample: thanks for stopping by, here is your estimate.'],
      [1440, 'Sample: checking in on the estimate.'],
      [4320, 'Sample: last check-in on the estimate.']
    ].entries()) {
      const stepId = id(`step:${i}`);
      await sql`insert into automation_steps (id, tenant_id, automation_id, position, channel, delay_minutes, body)
        values (${stepId}, ${tenantId}, ${automationId}, ${i + 1}, 'sms', ${delay as number}, ${body as string})`;
      await ledger(sql, tenantId, 'automation_steps', stepId);
      count++;
    }
  }
  for (const [i, p] of people.filter((q) => q.stage === 'Quoted').entries()) {
    const runId = id(`run:${i}`);
    await sql`insert into automation_runs
      (id, tenant_id, automation_id, contact_id, deal_id, current_step, status, next_run_at, created_at)
      values (${runId}, ${tenantId}, ${automationId}, ${p.contactId}, ${p.dealId}, ${1 + (i % 3)}, 'active',
        ${new Date(now.getTime() + 3 * DAY_MS).toISOString()}, ${daysAgo(2).toISOString()})`;
    await ledger(sql, tenantId, 'automation_runs', runId);
    count++;
  }
  return count;
}

const CHILD_FIRST = [
  'review_requests',
  'review_snapshots',
  'presence_items',
  'automation_runs',
  'automation_steps',
  'automations',
  'activities',
  'tasks',
  'messages',
  'appointments',
  'calls',
  'deal_contacts',
  'deals',
  'contacts'
] as const;

export type ShopDemoRemoveResult = {
  slug: string;
  status: 'planned' | 'removed' | 'not_seeded' | 'skipped_missing';
  rows: number;
};

/** Deletes exactly the rows recorded for this batch. Dry run unless `apply`. */
export async function removeShopDemo(
  sql: Sql,
  opts: { slug?: string; apply?: boolean } = {}
): Promise<ShopDemoRemoveResult> {
  const slug = opts.slug ?? SHOP_DEMO_SLUG;
  const tenantId = await findTenant(sql, slug);
  if (!tenantId) return { slug, status: 'skipped_missing', rows: 0 };
  const records = await sql`select table_name, record_id, before from demo_seed_records
    where tenant_id = ${tenantId} and seed_batch = ${SHOP_DEMO_BATCH}`;
  const rows = records.filter((r) => !String(r.table_name).startsWith('__')).length;
  if (records.length === 0) return { slug, status: 'not_seeded', rows: 0 };
  if (!opts.apply) return { slug, status: 'planned', rows };
  await sql.begin(async (raw) => {
    const tx = raw as unknown as Sql;
    const [admin] =
      await tx`select id from users where kynetic_role = 'admin' and disabled_at is null
      order by created_at limit 1`;
    const [owner] = await tx`select user_id from memberships where tenant_id = ${tenantId}
      and role = 'owner' order by created_at limit 1`;
    const actor = (admin?.id ?? owner?.user_id) as string;
    await tx`select set_config('app.tenant_id', ${tenantId}, true), set_config('app.user_id', ${actor}, true),
      set_config('app.role', 'admin', true), set_config('app.read_only', 'off', true)`;
    for (const table of CHILD_FIRST) {
      for (const row of records.filter((r) => r.table_name === table)) {
        if (table === 'deal_contacts') {
          const before = (typeof row.before === 'string' ? JSON.parse(row.before) : row.before) as {
            dealId: string;
            contactId: string;
          };
          await tx`delete from deal_contacts where tenant_id = ${tenantId}
            and deal_id = ${before.dealId} and contact_id = ${before.contactId}`;
        } else {
          await tx.unsafe(`delete from "${table}" where tenant_id = $1 and id = $2`, [
            tenantId,
            row.record_id
          ]);
        }
      }
    }
    await tx`delete from demo_seed_records where tenant_id = ${tenantId} and seed_batch = ${SHOP_DEMO_BATCH}`;
  });
  return { slug, status: 'removed', rows };
}
