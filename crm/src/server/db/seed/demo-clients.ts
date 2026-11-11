import { createHash } from 'node:crypto';
import { v5 as uuidv5 } from 'uuid';
import type postgres from 'postgres';
import { createDb } from '../client';
import { getAgencyWorkspace } from '../../agency';
import { AGENCY_SYNTHETIC_SLUG } from '../../agency/constants';
import { INDUSTRY_TEMPLATES } from '../../admin/industry-templates';
import { rollupMetricsDaily } from '../../metrics/daily';
import {
  DEMO_CLIENT_BY_SLUG,
  DEMO_CLIENT_PROFILES,
  NICHE_COPY,
  type DemoClientProfile
} from './demo-client-profiles';

type Sql = postgres.Sql;
const BATCH = 'demo-clients-v1';
const NS = '4ba80c7e-4140-4b8a-bf77-1946f4a62878';
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
const LOST_REASONS = ['Price', 'Went with another contractor', 'Not ready', 'No response'];

export type DemoSeedOptions = {
  only?: string;
  dryRun?: boolean;
  anchor?: string;
  noAgency?: boolean;
};
export type DemoSeedResult = {
  slug: string;
  status:
    | 'planned'
    | 'seeded'
    | 'already_seeded'
    | 'skipped_missing'
    | 'skipped_real_member'
    | 'skipped_status';
  inserted: number;
  anchor: string;
  metrics?: Record<'7' | '30' | '90', { leads: number; calls: number; booked: number }>;
};

const id = (slug: string, table: string, n: number | string) => uuidv5(`${slug}:${table}:${n}`, NS);
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const atDay = (anchor: string, daysAgo: number, hour = 16) => {
  const date = new Date(`${anchor}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
};
const chicagoToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
function validAnchor(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
    throw new Error(`invalid anchor: ${value}`);
  return value;
}
function rng(slug: string) {
  let a = Number.parseInt(createHash('sha256').update(slug).digest('hex').slice(0, 8), 16);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const phone = (n: number) => `+1214555${String(100 + (n % 100)).padStart(4, '0')}`;

async function ledger(
  sql: Sql,
  tenantId: string,
  table: string,
  recordId: string,
  before: unknown = null
) {
  const rows =
    await sql`insert into demo_seed_records (tenant_id,table_name,record_id,seed_batch,before)
    values (${tenantId},${table},${recordId},${BATCH},(${before == null ? null : JSON.stringify(before)}::text)::jsonb)
    on conflict do nothing returning record_id`;
  return rows.length;
}
async function inserted(
  sql: Sql,
  tenantId: string,
  table: string,
  recordId: string,
  query: () => PromiseLike<readonly unknown[]>
) {
  const rows = await query();
  if (rows.length) await ledger(sql, tenantId, table, recordId);
  return rows.length;
}

async function storedAnchor(sql: Sql): Promise<string | null> {
  const [row] = await sql`select before->>'anchor' as anchor from demo_seed_records
    where seed_batch=${BATCH} and table_name='__seed_meta__' order by created_at limit 1`;
  return (row?.anchor as string | undefined) ?? null;
}

async function eligibility(sql: Sql, profile: DemoClientProfile) {
  const [tenant] =
    await sql`select id,slug,status from tenants where id=${profile.tenantId} and slug=${profile.slug}`;
  if (!tenant) return 'skipped_missing' as const;
  if (tenant.status !== 'onboarding') return 'skipped_status' as const;
  const [real] =
    await sql`select count(*)::int as n from memberships m join users u on u.id=m.user_id
    where m.tenant_id=${profile.tenantId} and u.email not like '%@example.test'`;
  if ((real?.n as number) > 0) return 'skipped_real_member' as const;
  return null;
}

export async function seedDemoClients(
  sql: Sql,
  opts: DemoSeedOptions = {}
): Promise<DemoSeedResult[]> {
  if (opts.only && !DEMO_CLIENT_BY_SLUG.has(opts.only) && opts.only !== AGENCY_SYNTHETIC_SLUG)
    throw new Error(`unknown demo slug: ${opts.only}`);
  const existingAnchor = await storedAnchor(sql);
  const anchor = validAnchor(existingAnchor ?? opts.anchor ?? chicagoToday());
  const profiles = opts.only
    ? DEMO_CLIENT_PROFILES.filter((p) => p.slug === opts.only)
    : DEMO_CLIENT_PROFILES;
  const results: DemoSeedResult[] = [];
  for (const profile of profiles) {
    const blocked = await eligibility(sql, profile);
    if (blocked) {
      results.push({ slug: profile.slug, status: blocked, inserted: 0, anchor });
      continue;
    }
    const [prior] = await sql`select 1 from demo_seed_records where tenant_id=${profile.tenantId}
      and table_name='__seed_meta__' and seed_batch=${BATCH}`;
    if (prior) {
      results.push({ slug: profile.slug, status: 'already_seeded', inserted: 0, anchor });
      continue;
    }
    if (opts.dryRun) {
      results.push({
        slug: profile.slug,
        status: 'planned',
        inserted: plannedRows(profile),
        anchor
      });
      continue;
    }
    const count = await sql.begin((tx) => seedTenant(tx as unknown as Sql, profile, anchor));
    await rollupTenant(sql, profile, anchor);
    const metrics = await dashboardNumbers(sql, profile.tenantId, anchor);
    results.push({ slug: profile.slug, status: 'seeded', inserted: count, anchor, metrics });
  }
  if (!opts.noAgency && (!opts.only || opts.only === AGENCY_SYNTHETIC_SLUG) && !opts.dryRun)
    await seedAgency(sql, anchor);
  return results;
}

async function dashboardNumbers(sql: Sql, tenantId: string, anchor: string) {
  const output = {} as Record<'7' | '30' | '90', { leads: number; calls: number; booked: number }>;
  for (const days of [7, 30, 90] as const) {
    const [row] = await sql`select coalesce(sum(leads),0)::int as leads,
      coalesce(sum(calls),0)::int as calls,coalesce(sum(estimates_booked),0)::int as booked
      from metrics_daily where tenant_id=${tenantId}
      and day > (${anchor}::date - ${days}::int) and day <= ${anchor}::date`;
    output[String(days) as '7' | '30' | '90'] = {
      leads: row?.leads as number,
      calls: row?.calls as number,
      booked: row?.booked as number
    };
  }
  return output;
}

function plannedRows(p: DemoClientProfile) {
  return 30 + p.leads30 * 3 + p.calls30 * 3 + p.booked30 * 3 + p.messages30 * 3 + p.tasks30 * 3;
}

async function seedTenant(sql: Sql, p: DemoClientProfile, anchor: string): Promise<number> {
  let count = 0;
  const rand = rng(p.slug);
  const leadCount = p.leads30 * 3;
  const ownerId = id(p.slug, 'users', 'owner');
  const staffId = id(p.slug, 'users', 'staff');
  const metaId = id(p.slug, '__seed_meta__', 0);
  const adminRows =
    await sql`select id from users where kynetic_role='admin' and disabled_at is null order by created_at limit 1`;
  const adminId = (adminRows[0]?.id as string | undefined) ?? ownerId;
  await sql`select set_config('app.tenant_id', ${p.tenantId}, true), set_config('app.user_id', ${adminId}, true),
    set_config('app.role','admin',true), set_config('app.read_only','off',true)`;
  count += await ledger(sql, p.tenantId, '__seed_meta__', metaId, { anchor });

  const [beforeTenant] = await sql`select to_jsonb(t) as row from tenants t where id=${p.tenantId}`;
  count += await ledger(sql, p.tenantId, '__update_tenants__', p.tenantId, beforeTenant?.row);
  const copy = NICHE_COPY[p.niche];
  await sql`update tenants set
    avg_job_value_cents=coalesce(avg_job_value_cents,${p.avgJobCents}),
    business_hours=case when business_hours='{}'::jsonb then (${JSON.stringify({ mon: [['08:00', '18:00']], tue: [['08:00', '18:00']], wed: [['08:00', '18:00']], thu: [['08:00', '18:00']], fri: [['08:00', '18:00']], sat: [['09:00', '13:00']], sun: [] })}::text)::jsonb else business_hours end,
    service_area=case when service_area='{}'::jsonb or not (service_area ? 'zips') then service_area || (${JSON.stringify({ zips: ['75001', '75019', '75034'] })}::text)::jsonb else service_area end,
    email_sender_name=coalesce(email_sender_name,name), primary_color=coalesce(primary_color,'#5C5650'),
    guarantee_baseline_bookings=coalesce(guarantee_baseline_bookings,${p.baseline}),
    guarantee_start_date=coalesce(guarantee_start_date,${isoDay(atDay(anchor, 30))}::date),
    go_live_at=coalesce(go_live_at,${atDay(anchor, 45).toISOString()}), updated_at=now() where id=${p.tenantId}`;

  for (const [userId, email, name, role] of [
    [ownerId, `owner-${p.slug}@example.test`, 'Demo Owner', 'owner'],
    [staffId, `staff-${p.slug}@example.test`, 'Demo Staff', 'staff']
  ] as const) {
    count += await inserted(
      sql,
      p.tenantId,
      'users',
      userId,
      () => sql`insert into users (id,email,name,email_verified)
      values (${userId},${email},${name},true) on conflict do nothing returning id`
    );
    const membershipId = id(p.slug, 'memberships', role);
    count += await inserted(
      sql,
      p.tenantId,
      'memberships',
      membershipId,
      () => sql`insert into memberships
      (id,tenant_id,user_id,role,can_export,can_bulk_delete) values (${membershipId},${p.tenantId},${userId},${role},${role === 'owner'},${role === 'owner'}) on conflict do nothing returning id`
    );
  }
  const inviteId = id(p.slug, 'invitations', 0);
  count += await inserted(
    sql,
    p.tenantId,
    'invitations',
    inviteId,
    () => sql`insert into invitations
    (id,tenant_id,email,role,token_hash,invited_by,expires_at,created_at) values
    (${inviteId},${p.tenantId},${`invite-${p.slug}@example.test`},'staff',${createHash('sha256').update(`${p.slug}:invite`).digest('hex')},${ownerId},${atDay(anchor, -14).toISOString()},${atDay(anchor, 0).toISOString()}) on conflict do nothing returning id`
  );

  const modules = ['crm', 'opm', ...p.systems];
  for (const moduleKey of new Set(modules)) {
    const [before] =
      await sql`select to_jsonb(m) as row from tenant_modules m where tenant_id=${p.tenantId} and module_key=${moduleKey}`;
    const marker = id(p.slug, 'tenant_modules', moduleKey);
    count += await ledger(sql, p.tenantId, '__update_tenant_modules__', marker, {
      moduleKey,
      row: before?.row ?? null
    });
    await sql`select set_tenant_module(${p.tenantId}::uuid,${moduleKey},true,${moduleKey === 'crm' ? 'full' : ''})`;
  }

  const [beforeAlex] =
    await sql`select to_jsonb(a) as row from alex_configs a where tenant_id=${p.tenantId}`;
  count += await ledger(sql, p.tenantId, '__update_alex_configs__', p.tenantId, beforeAlex?.row);
  await sql`update alex_configs set provider='fake',paused=true,greeting=${`Hi {first_name}, this is Alex, an AI assistant with ${p.name}. I'm calling about the {service} request you sent. Do you have a minute?`},
    questions=(${JSON.stringify(copy.questions)}::text)::jsonb,booking_rules=(${JSON.stringify({ summary: copy.booking, durationMinutes: p.niche === 'roofing' || p.niche === 'windows_doors' ? 60 : 90 })}::text)::jsonb,
    call_windows=(${JSON.stringify({ start: '09:00', end: '20:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] })}::text)::jsonb,retry=(${JSON.stringify({ perDay: 3, delaysMinutes: [0, 120, 1440], stopOn: ['reply', 'booked', 'dnc'] })}::text)::jsonb,updated_at=now()
    where tenant_id=${p.tenantId}`;

  await applyPipeline(sql, p, count);
  const [pipeline] =
    await sql`select id from pipelines where tenant_id=${p.tenantId} and is_default=true limit 1`;
  const stages =
    await sql`select id,name,is_won,is_lost from pipeline_stages where tenant_id=${p.tenantId} and pipeline_id=${pipeline!.id} order by position`;
  for (const tag of ['hot', 'financing', 'insurance-claim', 'repeat', 'referral', 'HOA']) {
    const tagId = id(p.slug, 'tags', tag);
    count += await inserted(
      sql,
      p.tenantId,
      'tags',
      tagId,
      () =>
        sql`insert into tags (id,tenant_id,name) values (${tagId},${p.tenantId},${tag}) on conflict do nothing returning id`
    );
  }
  for (const [i, label] of ['Budget range', 'Project timeline', 'HOA approval'].entries()) {
    const fieldId = id(p.slug, 'custom_field_defs', i);
    count += await inserted(
      sql,
      p.tenantId,
      'custom_field_defs',
      fieldId,
      () => sql`insert into custom_field_defs
      (id,tenant_id,entity,label,key,type,position,options) values (${fieldId},${p.tenantId},'contact',${label},${`demo_${i}`},'text',${i},'[]') on conflict do nothing returning id`
    );
  }

  const contacts: { id: string; dealId: string; created: Date; source: string }[] = [];
  for (let i = 0; i < leadCount; i++) {
    const contactId = id(p.slug, 'contacts', i),
      dealId = id(p.slug, 'deals', i);
    const daysAgo = 89 - (i % 90),
      created = atDay(anchor, daysAgo, 14 + (i % 6));
    const source =
      i % 20 < 11 ? 'meta_ads' : i % 20 < 15 ? 'form' : i % 20 < 18 ? 'google_ads' : 'referral';
    const first = FIRST[i % FIRST.length]!,
      last = LAST[(i + Math.floor(rand() * LAST.length)) % LAST.length]!;
    const email = `${first}.${last}.${i}.${p.slug}@example.test`.toLowerCase();
    const stageIndex = i % (stages.length - 2),
      stage = stages[stageIndex]!;
    count += await inserted(
      sql,
      p.tenantId,
      'contacts',
      contactId,
      () => sql`insert into contacts
      (id,tenant_id,first_name,last_name,primary_phone_e164,primary_email,phones,emails,address,timezone,source,status,tags,owner_id,custom,created_at,updated_at,imported_source,external_id)
      values (${contactId},${p.tenantId},${first},${last},${phone(i)},${email},${`{${phone(i)}}`}::text[],${`{${email}}`}::text[],(${JSON.stringify({ city: 'Demo City', state: 'TX' })}::text)::jsonb,'America/Chicago',${source},'working',${i % 7 === 0 ? '{hot}' : '{}'}::text[],${ownerId},(${JSON.stringify({ synthetic: true })}::text)::jsonb,${created.toISOString()},${created.toISOString()},'synthetic_demo',${`demo-contact-${i}`}) on conflict do nothing returning id`
    );
    const value = Math.round(p.avgJobCents * (0.6 + rand() * 0.8));
    count += await inserted(
      sql,
      p.tenantId,
      'deals',
      dealId,
      () => sql`insert into deals
      (id,tenant_id,pipeline_id,stage_id,title,value_cents,service_type,source,owner_id,position,custom,created_at,updated_at,imported_source,external_id)
      values (${dealId},${p.tenantId},${pipeline!.id},${stage.id},${`${copy.services[i % copy.services.length]} — ${last}`},${value},${copy.services[i % copy.services.length]},${source},${ownerId},${`d${String(i).padStart(5, '0')}`},(${JSON.stringify({ synthetic: true })}::text)::jsonb,${created.toISOString()},${created.toISOString()},'synthetic_demo',${`demo-deal-${i}`}) on conflict do nothing returning id`
    );
    const linkId = id(p.slug, 'deal_contacts', i);
    const link =
      await sql`insert into deal_contacts (tenant_id,deal_id,contact_id,role) values (${p.tenantId},${dealId},${contactId},'homeowner') on conflict do nothing returning deal_id`;
    if (link.length) {
      await ledger(sql, p.tenantId, 'deal_contacts', linkId, { dealId, contactId });
      count++;
    }
    const consentId = id(p.slug, 'consents', i);
    count += await inserted(
      sql,
      p.tenantId,
      'consents',
      consentId,
      () => sql`insert into consents
      (id,tenant_id,contact_id,channel,kind,source,captured_text,wording_version,captured_at)
      values (${consentId},${p.tenantId},${contactId},'phone_call',${i < 2 ? 'opt_out' : 'express_written'},${source === 'form' ? 'website_form' : 'demo_import'},'Synthetic demo consent','demo-v1',${created.toISOString()}) on conflict do nothing returning id`
    );
    contacts.push({ id: contactId, dealId, created, source });
  }

  count += await seedCalls(sql, p, anchor, contacts);
  count += await seedAppointments(sql, p, anchor, contacts, ownerId, stages);
  count += await seedMessagesTasksNotes(sql, p, anchor, contacts, ownerId);
  count += await seedAutomation(sql, p, anchor, contacts);
  count += await seedSupporting(sql, p, anchor, ownerId, staffId, contacts);
  for (let day = 0; day < 90; day++) {
    const key = id(p.slug, 'metrics_daily', isoDay(atDay(anchor, day)));
    const [before] =
      await sql`select to_jsonb(m) as row from metrics_daily m where tenant_id=${p.tenantId} and day=${isoDay(atDay(anchor, day))}::date`;
    count += await ledger(sql, p.tenantId, '__upsert_metrics_daily__', key, {
      day: isoDay(atDay(anchor, day)),
      row: before?.row ?? null
    });
    const usageKey = id(p.slug, 'usage_daily', isoDay(atDay(anchor, day)));
    const [beforeUsage] =
      await sql`select to_jsonb(u) as row from usage_daily u where tenant_id=${p.tenantId} and day=${isoDay(atDay(anchor, day))}::date`;
    count += await ledger(sql, p.tenantId, '__upsert_usage_daily__', usageKey, {
      day: isoDay(atDay(anchor, day)),
      row: beforeUsage?.row ?? null
    });
    await sql`insert into usage_daily (tenant_id,day,call_count,call_seconds,call_cost_cents,sms_count,email_count,message_cost_cents,cost_unknown)
      values (${p.tenantId},${isoDay(atDay(anchor, day))},${Math.round(p.calls30 / 30)},${Math.round(p.calls30 / 30) * 95},${Math.round(p.calls30 / 30) * 18},${Math.round(p.messages30 / 45)},${Math.round(p.messages30 / 90)},${Math.round(p.messages30 / 45) * 2},false)
      on conflict (tenant_id,day) do update set call_count=excluded.call_count,call_seconds=excluded.call_seconds,call_cost_cents=excluded.call_cost_cents,sms_count=excluded.sms_count,email_count=excluded.email_count,message_cost_cents=excluded.message_cost_cents,cost_unknown=false`;
  }
  return count;
}

async function applyPipeline(sql: Sql, p: DemoClientProfile, count: number) {
  if (p.template === 'roofing') return count;
  const [nonDemo] =
    await sql`select count(*)::int as n from deals where tenant_id=${p.tenantId} and coalesce(imported_source,'')<>'synthetic_demo' and deleted_at is null`;
  if ((nonDemo?.n as number) > 0) return count;
  const template = INDUSTRY_TEMPLATES[p.template];
  const stages =
    await sql`select id,name,probability from pipeline_stages where tenant_id=${p.tenantId} and pipeline_id=(select id from pipelines where tenant_id=${p.tenantId} and is_default=true limit 1) order by position`;
  if (stages.length !== template.stages?.length) return count;
  for (const [i, stage] of stages.entries()) {
    const next = template.stages![i]!;
    await ledger(sql, p.tenantId, '__update_pipeline_stages__', stage.id as string, {
      name: stage.name,
      probability: stage.probability
    });
    await sql`update pipeline_stages set name=${next.name},probability=${next.probability} where id=${stage.id}`;
  }
  await sql`insert into audit_log (tenant_id,actor_user_id,action,entity,entity_id,before,after) values
    (${p.tenantId},app_user_id(),'template.apply','tenant',${p.tenantId},(${JSON.stringify({ stages: stages.map((s) => s.name) })}::text)::jsonb,(${JSON.stringify({ industry: p.template, stages: template.stages!.map((s) => s.name) })}::text)::jsonb)`;
  return count;
}

async function seedCalls(
  sql: Sql,
  p: DemoClientProfile,
  anchor: string,
  contacts: { id: string; dealId: string; created: Date; source: string }[]
) {
  let count = 0,
    total = p.calls30 * 3,
    reached = p.reached30 * 3;
  for (let i = 0; i < total; i++) {
    const c = contacts[i % contacts.length]!,
      callId = id(p.slug, 'calls', i);
    const firstForContact = i < contacts.length;
    const afterGoLive = c.created >= atDay(anchor, 45);
    const delay = firstForContact
      ? afterGoLive
        ? 60 + (i % 3) * 60
        : 2700 + (i % 196) * 60
      : 3600 + (i % 6) * 1800;
    const started = new Date(c.created.getTime() + delay * 1000),
      isReached = i < reached;
    const outcome = isReached
      ? i % 10 < 3
        ? 'booked'
        : i % 10 < 7
          ? 'qualified'
          : i % 10 === 7
            ? 'transferred'
            : 'not_interested'
      : i % 5 < 3
        ? 'no_answer'
        : 'voicemail';
    count += await inserted(
      sql,
      p.tenantId,
      'calls',
      callId,
      () => sql`insert into calls
      (id,tenant_id,contact_id,deal_id,provider,provider_call_id,direction,started_at,ended_at,duration_s,outcome,sentiment,transcript,summary,extracted,cost_cents,created_at,updated_at)
      values (${callId},${p.tenantId},${c.id},${c.dealId},'fake',${`${p.slug}-demo-call-${i}`},'outbound',${started.toISOString()},${new Date(started.getTime() + 95000).toISOString()},95,${outcome},${isReached ? 'positive' : 'unknown'},${isReached ? 'Alex: Thanks for requesting an estimate. Customer: A consultation next week works.' : null},${isReached ? 'Synthetic demo: customer discussed the project and next steps.' : null},(${JSON.stringify({ synthetic: true })}::text)::jsonb,18,${started.toISOString()},${started.toISOString()}) on conflict do nothing returning id`
    );
  }
  return count;
}

async function seedAppointments(
  sql: Sql,
  p: DemoClientProfile,
  anchor: string,
  contacts: { id: string; dealId: string }[],
  ownerId: string,
  stages: Record<string, unknown>[]
) {
  let count = 0,
    total = p.booked30 * 3,
    won = p.won30 * 3;
  for (let i = 0; i < total; i++) {
    const c = contacts[i % contacts.length]!,
      appointmentId = id(p.slug, 'appointments', i),
      day = 89 - Math.floor((i * 90) / total),
      created = atDay(anchor, day);
    const status =
      i % 10 < 7
        ? 'completed'
        : i % 10 === 7
          ? 'no_show'
          : i % 10 === 8
            ? 'cancelled'
            : 'scheduled';
    count += await inserted(
      sql,
      p.tenantId,
      'appointments',
      appointmentId,
      () => sql`insert into appointments
      (id,tenant_id,contact_id,deal_id,starts_at,ends_at,address,status,booked_by,created_by,created_at,updated_at,notes)
      values (${appointmentId},${p.tenantId},${c.id},${c.dealId},${new Date(created.getTime() + 86400000).toISOString()},${new Date(created.getTime() + 90000000).toISOString()},(${JSON.stringify({ city: 'Demo City', state: 'TX' })}::text)::jsonb,${status},${i % 5 ? 'alex' : 'user'},${i % 5 ? null : ownerId},${created.toISOString()},${created.toISOString()},'Synthetic demo appointment') on conflict do nothing returning id`
    );
    if (i < won) {
      const wonStage = stages.find((s) => s.is_won) as { id: string } | undefined;
      if (wonStage)
        await sql`update deals set stage_id=${wonStage.id},won_at=${created.toISOString()},updated_at=${created.toISOString()} where id=${c.dealId}`;
    }
  }
  const lostStage = stages.find((stage) => stage.is_lost) as { id: string } | undefined;
  if (lostStage) {
    const lost = Math.min(Math.round(contacts.length * 0.12), contacts.length - won);
    for (let i = 0; i < lost; i++) {
      const contact = contacts[won + i]!;
      const lostAt = atDay(anchor, i % 30);
      await sql`update deals set stage_id=${lostStage.id},lost_at=${lostAt.toISOString()},
        lost_reason=${LOST_REASONS[i % LOST_REASONS.length]},updated_at=${lostAt.toISOString()}
        where tenant_id=${p.tenantId} and id=${contact.dealId}`;
    }
  }
  return count;
}

async function seedMessagesTasksNotes(
  sql: Sql,
  p: DemoClientProfile,
  anchor: string,
  contacts: { id: string; dealId: string }[],
  ownerId: string
) {
  let count = 0;
  for (let i = 0; i < p.messages30 * 3; i++) {
    const c = contacts[i % contacts.length]!,
      rid = id(p.slug, 'messages', i),
      created = atDay(anchor, 89 - (i % 90));
    count += await inserted(
      sql,
      p.tenantId,
      'messages',
      rid,
      () => sql`insert into messages
    (id,tenant_id,contact_id,deal_id,channel,direction,actor_type,from_address,to_address,subject,body,provider,provider_message_id,status,sent_at,delivered_at,created_at)
    values (${rid},${p.tenantId},${c.id},${c.dealId},${i % 3 ? 'sms' : 'email'},'outbound','automation','demo@example.test',${i % 3 ? phone(i) : `lead-${i}@example.test`},${i % 3 ? null : 'Your consultation'},'Synthetic demo reminder','fake',${`${p.slug}-demo-message-${i}`},${i % 4 ? 'sent' : 'queued'},${created.toISOString()},${i % 4 ? created.toISOString() : null},${created.toISOString()}) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < p.tasks30 * 3; i++) {
    const c = contacts[i % contacts.length]!,
      rid = id(p.slug, 'tasks', i),
      created = atDay(anchor, 89 - (i % 90));
    count += await inserted(
      sql,
      p.tenantId,
      'tasks',
      rid,
      () => sql`insert into tasks
    (id,tenant_id,title,due_at,assignee_id,contact_id,deal_id,priority,completed_at,completed_by,created_by,created_at,updated_at)
    values (${rid},${p.tenantId},${['Call back', 'Send quote', 'Confirm appointment'][i % 3]},${new Date(created.getTime() + 86400000).toISOString()},${ownerId},${c.id},${c.dealId},${i % 7 === 0 ? 'high' : 'normal'},${i % 3 ? created.toISOString() : null},${i % 3 ? ownerId : null},${ownerId},${created.toISOString()},${created.toISOString()}) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < Math.round(contacts.length * 0.35); i++) {
    const c = contacts[i]!,
      rid = id(p.slug, 'notes', i),
      created = atDay(anchor, 89 - (i % 90));
    count += await inserted(
      sql,
      p.tenantId,
      'notes',
      rid,
      () => sql`insert into notes
    (id,tenant_id,body_text,body_json,author_id,contact_id,deal_id,created_at,updated_at,imported_source,external_id)
    values (${rid},${p.tenantId},'Synthetic demo site-visit note',(${JSON.stringify({ type: 'doc', synthetic: true })}::text)::jsonb,${ownerId},${c.id},${c.dealId},${created.toISOString()},${created.toISOString()},'synthetic_demo',${`demo-note-${i}`}) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < contacts.length * 8; i++) {
    const c = contacts[i % contacts.length]!,
      rid = id(p.slug, 'activities', i),
      created = atDay(anchor, 89 - (i % 90));
    count += await inserted(
      sql,
      p.tenantId,
      'activities',
      rid,
      () => sql`insert into activities
    (id,tenant_id,contact_id,deal_id,type,summary,actor_type,actor_id,occurred_at,meta,created_at)
    values (${rid},${p.tenantId},${c.id},${c.dealId},${i % 2 ? 'call' : 'system'},${i % 2 ? 'Synthetic demo call activity' : 'Synthetic demo lead created'},${i % 2 ? 'alex' : 'system'},${i % 2 ? null : ownerId},${created.toISOString()},(${JSON.stringify({ synthetic: true })}::text)::jsonb,${created.toISOString()}) on conflict do nothing returning id`
    );
  }
  return count;
}

async function seedAutomation(
  sql: Sql,
  p: DemoClientProfile,
  anchor: string,
  contacts: { id: string; dealId: string }[]
) {
  let count = 0;
  const keys = [
    'speed_to_lead',
    'appointment_reminders',
    'no_show_recovery',
    'quote_followup',
    ...(p.niche === 'remodeling' ? ['reactivation'] : [])
  ];
  const automationIds: string[] = [];
  for (const key of keys) {
    const rid = id(p.slug, 'automations', key);
    automationIds.push(rid);
    count += await inserted(
      sql,
      p.tenantId,
      'automations',
      rid,
      () =>
        sql`insert into automations (id,tenant_id,kind,template_key,name,enabled,config) values (${rid},${p.tenantId},'template',${key},${key.replaceAll('_', ' ')},true,(${JSON.stringify({ synthetic: true })}::text)::jsonb) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < p.automationRuns30 * 3; i++) {
    const c = contacts[i % contacts.length]!,
      rid = id(p.slug, 'automation_runs', i),
      created = atDay(anchor, 89 - (i % 90)),
      status = ['completed', 'stopped_booked', 'stopped_reply'][i % 3];
    count += await inserted(
      sql,
      p.tenantId,
      'automation_runs',
      rid,
      () => sql`insert into automation_runs
    (id,tenant_id,automation_id,contact_id,deal_id,current_step,status,created_at,updated_at) values (${rid},${p.tenantId},${automationIds[i % automationIds.length]},${c.id},${c.dealId},1,${status},${created.toISOString()},${created.toISOString()}) on conflict do nothing returning id`
    );
  }
  return count;
}

async function seedSupporting(
  sql: Sql,
  p: DemoClientProfile,
  anchor: string,
  ownerId: string,
  staffId: string,
  contacts: { id: string }[]
) {
  let count = 0;
  for (let i = 0; i < 2; i++) {
    const rid = id(p.slug, 'companies', i);
    count += await inserted(
      sql,
      p.tenantId,
      'companies',
      rid,
      () => sql`insert into companies (id,tenant_id,name,phone_e164,website,address,custom,created_at,updated_at,imported_source,external_id)
    values (${rid},${p.tenantId},${`Demo Property Partner ${i + 1}`},${phone(80 + i)},'https://example.test',(${JSON.stringify({ city: 'Demo City', state: 'TX' })}::text)::jsonb,(${JSON.stringify({ synthetic: true })}::text)::jsonb,${atDay(anchor, 60 - i).toISOString()},${atDay(anchor, 60 - i).toISOString()},'synthetic_demo',${`demo-company-${i}`}) on conflict do nothing returning id`
    );
  }
  for (const [i, category] of ['general', 'alex_change'].entries()) {
    const rid = id(p.slug, 'support_requests', i);
    count += await inserted(
      sql,
      p.tenantId,
      'support_requests',
      rid,
      () => sql`insert into support_requests
    (id,tenant_id,subject,body,category,status,submitted_by,created_at,updated_at) values (${rid},${p.tenantId},${category === 'general' ? 'Demo portal question' : 'Demo Alex change'},'Synthetic demo support request.',${category},${i ? 'in_progress' : 'open'},${ownerId},${atDay(anchor, 12 - i).toISOString()},${atDay(anchor, 12 - i).toISOString()}) on conflict do nothing returning id`
    );
    for (let j = 0; j < 2; j++) {
      const mid = id(p.slug, 'support_request_messages', `${i}-${j}`);
      count += await inserted(
        sql,
        p.tenantId,
        'support_request_messages',
        mid,
        () => sql`insert into support_request_messages
      (id,tenant_id,request_id,author_user_id,author_side,body,created_at) values (${mid},${p.tenantId},${rid},${j ? staffId : ownerId},${j ? 'kynetic' : 'client'},${j ? 'Synthetic Kynetic reply.' : 'Synthetic client follow-up.'},${atDay(anchor, 10 - i - j).toISOString()}) on conflict do nothing returning id`
      );
    }
  }
  const requestId = id(p.slug, 'system_requests', 0);
  count += await inserted(
    sql,
    p.tenantId,
    'system_requests',
    requestId,
    () => sql`insert into system_requests (id,tenant_id,module_key,status,requested_by,created_at)
    values (${requestId},${p.tenantId},'followup_bundle','open',${ownerId},${atDay(anchor, 8).toISOString()}) on conflict do nothing returning id`
  );
  for (let i = 0; i < 4; i++) {
    const rid = id(p.slug, 'presence_items', i);
    count += await inserted(
      sql,
      p.tenantId,
      'presence_items',
      rid,
      () => sql`insert into presence_items
    (id,tenant_id,kind,title,status,notes,created_at,updated_at) values (${rid},${p.tenantId},'profile',${`Demo presence task ${i + 1}`},${i < 2 ? 'done' : 'planned'},'Synthetic demo item',${atDay(anchor, 30 - i).toISOString()},${atDay(anchor, 30 - i).toISOString()}) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < 3; i++) {
    const rid = id(p.slug, 'review_snapshots', i),
      captured = isoDay(atDay(anchor, 30 * (i + 1)));
    count += await inserted(
      sql,
      p.tenantId,
      'review_snapshots',
      rid,
      () => sql`insert into review_snapshots
    (id,tenant_id,source,captured_on,review_count,average_rating) values (${rid},${p.tenantId},'Demo monthly snapshot',${captured},${12 + i * 3},${(4.5 + i * 0.1).toFixed(2)}) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < 3; i++) {
    const rid = id(p.slug, 'reports', i),
      period = isoDay(
        new Date(Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 2 - i, 1))
      );
    count += await inserted(
      sql,
      p.tenantId,
      'reports',
      rid,
      () => sql`insert into reports
    (id,tenant_id,kind,period_start,status,storage_key,created_at) values (${rid},${p.tenantId},'monthly_roi',${period},'ready',${`demo/${p.slug}/monthly-${period}.pdf`},${atDay(anchor, 30 * i).toISOString()}) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < Math.min(contacts.length, 90); i++) {
    const rid = id(p.slug, 'notifications', i);
    count += await inserted(
      sql,
      p.tenantId,
      'notifications',
      rid,
      () => sql`insert into notifications
    (id,tenant_id,user_id,kind,title,body,link,created_at) values (${rid},${p.tenantId},${ownerId},${['new_lead', 'booked', 'hot_lead', 'report_ready'][i % 4]},'Synthetic demo update','Demo data','/dashboard',${atDay(anchor, i % 90).toISOString()}) on conflict do nothing returning id`
    );
  }
  for (const [i, key] of ['profile', 'systems', 'alex', 'pipeline'].entries()) {
    const rid = id(p.slug, 'onboarding_steps', i);
    count += await inserted(
      sql,
      p.tenantId,
      'onboarding_steps',
      rid,
      () => sql`insert into onboarding_steps
    (id,tenant_id,step_key,title,client_visible,status,owner_user_id,due_date,done_at,note) values (${rid},${p.tenantId},${`demo_${key}`},${`Demo ${key} setup`},true,'done',${ownerId},${isoDay(atDay(anchor, 50 - i))},${atDay(anchor, 49 - i).toISOString()},'Synthetic demo setup') on conflict do nothing returning id`
    );
  }
  return count;
}

async function rollupTenant(sql: Sql, p: DemoClientProfile, anchor: string) {
  const db = createDb(sql);
  for (let day = 0; day < 90; day++)
    await rollupMetricsDaily({ tenantId: p.tenantId, day: isoDay(atDay(anchor, day)) }, { db });
}

async function seedAgency(sql: Sql, anchor: string) {
  const [admin] =
    await sql`select id from users where kynetic_role='admin' and disabled_at is null order by created_at limit 1`;
  if (!admin)
    throw new Error('an active Kynetic admin is required to create the agency demo workspace');
  const db = createDb(sql),
    workspace = await getAgencyWorkspace({ id: admin.id as string, kyneticRole: 'admin' }, true, {
      db,
      scheduleJobs: false
    });
  if (!workspace) return;
  if (typeof workspace.tenantId !== 'string')
    throw new Error(`invalid agency workspace tenant id: ${JSON.stringify(workspace.tenantId)}`);
  const [prior] =
    await sql`select 1 from demo_seed_records where tenant_id=${workspace.tenantId} and table_name='__seed_meta__' and seed_batch=${BATCH}`;
  if (prior) return;
  await sql.begin(async (raw) => {
    const tx = raw as unknown as Sql;
    await ledger(
      tx,
      workspace.tenantId,
      '__seed_meta__',
      id(AGENCY_SYNTHETIC_SLUG, '__seed_meta__', 0),
      { anchor, workspaceCreated: workspace.created }
    );
    const [pipeline] =
      await tx`select id from pipelines where tenant_id=${workspace.tenantId} and is_default=true`;
    const stages =
      await tx`select id from pipeline_stages where tenant_id=${workspace.tenantId} and pipeline_id=${pipeline!.id} order by position`;
    for (let i = 0; i < 60; i++) {
      const cid = id(AGENCY_SYNTHETIC_SLUG, 'contacts', i),
        did = id(AGENCY_SYNTHETIC_SLUG, 'deals', i),
        name = `Texas Growth Prospect ${i + 1} (demo)`,
        created = atDay(anchor, i % 30).toISOString();
      await inserted(
        tx,
        workspace.tenantId,
        'contacts',
        cid,
        () => tx`insert into contacts
      (id,tenant_id,first_name,primary_phone_e164,primary_email,phones,emails,address,source,status,custom,created_at,updated_at,imported_source,external_id) values
      (${cid},${workspace.tenantId},${name},${phone(i)},${`prospect-${i}@example.test`},${`{${phone(i)}}`}::text[],${`{prospect-${i}@example.test}`}::text[],(${JSON.stringify({ city: 'Austin', state: 'TX' })}::text)::jsonb,'agency_outbound_cold_call','working',(${JSON.stringify({ synthetic: true })}::text)::jsonb,${created},${created},'synthetic_demo',${`agency-demo-${i}`}) on conflict do nothing returning id`
      );
      await inserted(
        tx,
        workspace.tenantId,
        'deals',
        did,
        () => tx`insert into deals
      (id,tenant_id,pipeline_id,stage_id,title,value_cents,source,position,custom,created_at,updated_at,imported_source,external_id) values (${did},${workspace.tenantId},${pipeline!.id},${stages[i % stages.length]!.id},${name},0,'agency_outbound_cold_call',${`a${i}`},(${JSON.stringify({ synthetic: true, price: 'to be confirmed' })}::text)::jsonb,${created},${created},'synthetic_demo',${`agency-deal-${i}`}) on conflict do nothing returning id`
      );
      const linked =
        await tx`insert into deal_contacts (tenant_id,deal_id,contact_id,role) values (${workspace.tenantId},${did},${cid},'other') on conflict do nothing returning deal_id`;
      if (linked.length)
        await ledger(
          tx,
          workspace.tenantId,
          'deal_contacts',
          id(AGENCY_SYNTHETIC_SLUG, 'deal_contacts', i),
          { dealId: did, contactId: cid }
        );
    }
    for (let i = 0; i < 150; i++) {
      const rid = id(AGENCY_SYNTHETIC_SLUG, 'agency_call_attempts', i);
      await inserted(
        tx,
        workspace.tenantId,
        'agency_call_attempts',
        rid,
        () => tx`insert into agency_call_attempts
      (id,tenant_id,contact_id,event_id,request_hash,outcome,notes,logged_by,logged_at) values (${rid},${workspace.tenantId},${id(AGENCY_SYNTHETIC_SLUG, 'contacts', i % 60)},${id(AGENCY_SYNTHETIC_SLUG, 'agency_call_event', i)},${createHash('sha256').update(`agency-call-${i}`).digest('hex')},${i % 4 === 0 ? 'connected' : i % 3 === 0 ? 'voicemail' : 'no_answer'},'Synthetic demo attempt',${admin.id},${atDay(anchor, i % 30).toISOString()}) on conflict do nothing returning id`
      );
    }
    await seedAgencyOperations(tx, workspace.tenantId, admin.id as string, anchor);
  });
}

async function seedAgencyOperations(sql: Sql, tenantId: string, adminId: string, anchor: string) {
  const campaigns: string[] = [];
  for (let i = 0; i < 2; i++) {
    const campaignId = id(AGENCY_SYNTHETIC_SLUG, 'agency_campaigns', i);
    campaigns.push(campaignId);
    await inserted(
      sql,
      tenantId,
      'agency_campaigns',
      campaignId,
      () => sql`insert into agency_campaigns
      (id,tenant_id,name,script,steps,created_by,created_at) values
      (${campaignId},${tenantId},${`Texas contractor outreach ${i + 1} (demo)`},'Synthetic demo script. No outbound delivery.',
       (${JSON.stringify([
         { channel: 'call', delayDays: 0 },
         { channel: 'dm', delayDays: 2 }
       ])}::text)::jsonb,
       ${adminId},${atDay(anchor, 25 - i).toISOString()}) on conflict do nothing returning id`
    );
    for (let j = 0; j < 15; j++) {
      const contactId = id(AGENCY_SYNTHETIC_SLUG, 'contacts', i * 15 + j);
      const key = id(AGENCY_SYNTHETIC_SLUG, 'agency_campaign_leads', `${i}-${j}`);
      const rows = await sql`insert into agency_campaign_leads (tenant_id,campaign_id,contact_id)
        values (${tenantId},${campaignId},${contactId}) on conflict do nothing returning contact_id`;
      if (rows.length)
        await ledger(sql, tenantId, 'agency_campaign_leads', key, { campaignId, contactId });
      const progress = await sql`insert into agency_campaign_progress
        (tenant_id,campaign_id,contact_id,step_index,due_at,state,enrolled_at) values
        (${tenantId},${campaignId},${contactId},${j % 2},${atDay(anchor, -(j % 5)).toISOString()},${j < 10 ? 'active' : 'complete'},${atDay(anchor, 20 - j).toISOString()})
        on conflict do nothing returning contact_id`;
      if (progress.length)
        await ledger(sql, tenantId, 'agency_campaign_progress', key, { campaignId, contactId });
    }
  }
  for (let i = 0; i < 20; i++) {
    const table = i % 2 ? 'agency_dm_logs' : 'agency_message_drafts';
    const recordId = id(AGENCY_SYNTHETIC_SLUG, table, i);
    const contactId = id(AGENCY_SYNTHETIC_SLUG, 'contacts', i);
    if (table === 'agency_dm_logs')
      await inserted(
        sql,
        tenantId,
        table,
        recordId,
        () => sql`insert into agency_dm_logs
        (id,tenant_id,contact_id,direction,platform,body,occurred_at,logged_by) values
        (${recordId},${tenantId},${contactId},${i % 4 ? 'outbound' : 'inbound'},'Instagram','Synthetic demo DM; no delivery occurred.',${atDay(anchor, i).toISOString()},${adminId}) on conflict do nothing returning id`
      );
    else
      await inserted(
        sql,
        tenantId,
        table,
        recordId,
        () => sql`insert into agency_message_drafts
        (id,tenant_id,contact_id,channel,subject,body,status,created_by,created_at) values
        (${recordId},${tenantId},${contactId},${i % 4 ? 'sms' : 'email'},'Demo follow-up','Synthetic demo draft; no delivery occurred.',${i % 3 ? 'draft' : 'simulated'},${adminId},${atDay(anchor, i).toISOString()}) on conflict do nothing returning id`
      );
  }
  for (let i = 0; i < 6; i++) {
    const recordId = id(AGENCY_SYNTHETIC_SLUG, 'agency_proposals', i);
    await inserted(
      sql,
      tenantId,
      'agency_proposals',
      recordId,
      () => sql`insert into agency_proposals
      (id,tenant_id,deal_id,title,status,problem,solution,roadmap,roi,created_by,updated_by,created_at,updated_at) values
      (${recordId},${tenantId},${id(AGENCY_SYNTHETIC_SLUG, 'deals', i)},${`Demo proposal ${i + 1} — price to be confirmed`},'draft','Synthetic needs summary','Synthetic portal plan','To be confirmed','To be confirmed',${adminId},${adminId},${atDay(anchor, 12 - i).toISOString()},${atDay(anchor, 12 - i).toISOString()}) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < 3; i++) {
    const recordId = id(AGENCY_SYNTHETIC_SLUG, 'agency_contracts', i);
    await inserted(
      sql,
      tenantId,
      'agency_contracts',
      recordId,
      () => sql`insert into agency_contracts
      (id,tenant_id,deal_id,title,status,sent_on,signed_on,notes,created_by,updated_by) values
      (${recordId},${tenantId},${id(AGENCY_SYNTHETIC_SLUG, 'deals', i)},${`Demo agreement ${i + 1}`},${i === 0 ? 'signed' : 'draft'},${i === 0 ? isoDay(atDay(anchor, 8)) : null},${i === 0 ? isoDay(atDay(anchor, 6)) : null},'Synthetic demo contract',${adminId},${adminId}) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < 2; i++) {
    const dealId = id(AGENCY_SYNTHETIC_SLUG, 'deals', i);
    const termKey = id(AGENCY_SYNTHETIC_SLUG, 'agency_deal_terms', i);
    const termRows = await sql`insert into agency_deal_terms
      (tenant_id,deal_id,currency,setup_cents,monthly_cents,installments,updated_by) values
      (${tenantId},${dealId},'USD',0,1,(${JSON.stringify([])}::text)::jsonb,${adminId})
      on conflict do nothing returning deal_id`;
    if (termRows.length) await ledger(sql, tenantId, 'agency_deal_terms', termKey, { dealId });
    const invoiceId = id(AGENCY_SYNTHETIC_SLUG, 'agency_invoice_drafts', i);
    await inserted(
      sql,
      tenantId,
      'agency_invoice_drafts',
      invoiceId,
      () => sql`insert into agency_invoice_drafts
      (id,tenant_id,deal_id,cycle_key,terms_hash,amount_cents,currency,due_on,status,provider) values
      (${invoiceId},${tenantId},${dealId},${`demo-${i}`},${createHash('sha256').update(`demo-terms-${i}`).digest('hex')},1,'USD',${isoDay(atDay(anchor, -14 - i))},'draft','stub')
      on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < 8; i++) {
    const recordId = id(AGENCY_SYNTHETIC_SLUG, 'agency_expenses', i);
    await inserted(
      sql,
      tenantId,
      'agency_expenses',
      recordId,
      () => sql`insert into agency_expenses
      (id,tenant_id,spent_on,vendor,category,amount_cents,note,created_by,updated_by) values
      (${recordId},${tenantId},${isoDay(atDay(anchor, i * 3))},${`Demo vendor ${i + 1}`},${i % 2 ? 'software' : 'marketing'},${2500 + i * 700},'Synthetic demo expense',${adminId},${adminId}) on conflict do nothing returning id`
    );
  }
  for (let i = 0; i < 2; i++) {
    const referralId = id(AGENCY_SYNTHETIC_SLUG, 'agency_referrals', i);
    await inserted(
      sql,
      tenantId,
      'agency_referrals',
      referralId,
      () => sql`insert into agency_referrals
      (id,tenant_id,referrer_name,contact_id,status,reward_note,created_by) values
      (${referralId},${tenantId},${`Demo Partner ${i + 1}`},${id(AGENCY_SYNTHETIC_SLUG, 'contacts', 40 + i)},'new','To be confirmed',${adminId}) on conflict do nothing returning id`
    );
    const caseId = id(AGENCY_SYNTHETIC_SLUG, 'agency_case_studies', i);
    await inserted(
      sql,
      tenantId,
      'agency_case_studies',
      caseId,
      () => sql`insert into agency_case_studies
      (id,tenant_id,status,note,created_by,updated_by) values
      (${caseId},${tenantId},'idea',${`Synthetic case-study idea ${i + 1}`},${adminId},${adminId}) on conflict do nothing returning id`
    );
    const alertId = id(AGENCY_SYNTHETIC_SLUG, 'agency_alerts', i);
    await inserted(
      sql,
      tenantId,
      'agency_alerts',
      alertId,
      () => sql`insert into agency_alerts
      (id,tenant_id,kind,title,body,event_key) values
      (${alertId},${tenantId},${i ? 'daily_digest' : 'new_lead'},${i ? 'Demo daily summary' : 'Demo lead alert'},'Synthetic demo alert',${`demo-alert-${i}`}) on conflict do nothing returning id`
    );
  }
}
