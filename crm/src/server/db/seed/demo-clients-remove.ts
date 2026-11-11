import type postgres from 'postgres';
import { AGENCY_SYNTHETIC_SLUG } from '../../agency/constants';
import { DEMO_CLIENT_BY_SLUG, DEMO_CLIENT_PROFILES } from './demo-client-profiles';

type Sql = postgres.Sql;
const BATCH = 'demo-clients-v1';
const CHILD_FIRST = [
  'support_request_messages',
  'support_requests',
  'agency_call_attempts',
  'automation_runs',
  'automations',
  'activities',
  'notes',
  'tasks',
  'messages',
  'appointments',
  'calls',
  'consents',
  'deal_contacts',
  'notifications',
  'system_requests',
  'presence_items',
  'review_snapshots',
  'reports',
  'onboarding_steps',
  'custom_field_defs',
  'tags',
  'deals',
  'contacts',
  'companies',
  'invitations',
  'memberships',
  'users'
];
export type DemoRemoveOptions = { only?: string; dryRun?: boolean };

export async function removeDemoClients(sql: Sql, opts: DemoRemoveOptions = {}) {
  if (opts.only && !DEMO_CLIENT_BY_SLUG.has(opts.only) && opts.only !== AGENCY_SYNTHETIC_SLUG)
    throw new Error(`unknown demo slug: ${opts.only}`);
  const profiles = opts.only
    ? DEMO_CLIENT_PROFILES.filter((p) => p.slug === opts.only)
    : DEMO_CLIENT_PROFILES;
  const results: { slug: string; rows: number; status: 'planned' | 'removed' | 'not_seeded' }[] =
    [];
  for (const p of profiles) {
    const [n] =
      await sql`select count(*)::int as n from demo_seed_records where tenant_id=${p.tenantId} and seed_batch=${BATCH}`;
    const rows = n?.n as number;
    if (!rows) {
      results.push({ slug: p.slug, rows: 0, status: 'not_seeded' });
      continue;
    }
    if (opts.dryRun) {
      results.push({ slug: p.slug, rows, status: 'planned' });
      continue;
    }
    await sql.begin((tx) => removeTenant(tx as unknown as Sql, p.tenantId));
    results.push({ slug: p.slug, rows, status: 'removed' });
  }
  if (!opts.only || opts.only === AGENCY_SYNTHETIC_SLUG) {
    const [agency] =
      await sql`select t.id from tenants t join agency_workspaces w on w.tenant_id=t.id where t.slug=${AGENCY_SYNTHETIC_SLUG}`;
    if (agency) {
      const [n] =
        await sql`select count(*)::int as n from demo_seed_records where tenant_id=${agency.id} and seed_batch=${BATCH}`;
      const rows = n?.n as number;
      if (rows && opts.dryRun)
        results.push({ slug: AGENCY_SYNTHETIC_SLUG, rows, status: 'planned' });
      else if (rows) {
        await sql.begin((tx) => removeAgency(tx as unknown as Sql, agency.id as string));
        results.push({ slug: AGENCY_SYNTHETIC_SLUG, rows, status: 'removed' });
      }
    }
  }
  return results;
}

async function removeTenant(sql: Sql, tenantId: string) {
  const records =
    await sql`select table_name,record_id,before from demo_seed_records where tenant_id=${tenantId} and seed_batch=${BATCH}`;
  for (const table of CHILD_FIRST) {
    for (const row of records.filter((r) => r.table_name === table)) {
      if (table === 'deal_contacts') {
        const before = (typeof row.before === 'string' ? JSON.parse(row.before) : row.before) as {
          dealId?: string;
          contactId?: string;
          dealid?: string;
          contactid?: string;
        };
        const dealId = before.dealId ?? before.dealid;
        const contactId = before.contactId ?? before.contactid;
        if (!dealId || !contactId) throw new Error('invalid deal_contacts demo ledger record');
        await sql`delete from deal_contacts where tenant_id=${tenantId} and deal_id=${dealId} and contact_id=${contactId}`;
      } else await sql.unsafe(`delete from "${table}" where id = $1`, [row.record_id]);
    }
  }
  for (const row of records.filter((r) => r.table_name === '__upsert_metrics_daily__')) {
    const before = decodeBefore(row.before) as {
      day: string;
      row: Record<string, unknown> | null;
    };
    if (before.row) await restoreRow(sql, 'metrics_daily', before.row, ['tenant_id', 'day']);
    else
      await sql`delete from metrics_daily where tenant_id=${tenantId} and day=${before.day}::date`;
  }
  for (const row of records.filter((r) => r.table_name === '__upsert_usage_daily__')) {
    const before = decodeBefore(row.before) as {
      day: string;
      row: Record<string, unknown> | null;
    };
    if (before.row) await restoreRow(sql, 'usage_daily', before.row, ['tenant_id', 'day']);
    else await sql`delete from usage_daily where tenant_id=${tenantId} and day=${before.day}::date`;
  }
  for (const row of records.filter((r) => r.table_name === '__update_pipeline_stages__')) {
    const before = decodeBefore(row.before) as { name: string; probability: number };
    await sql`update pipeline_stages set name=${before.name},probability=${before.probability} where tenant_id=${tenantId} and id=${row.record_id}`;
  }
  for (const row of records.filter((r) => r.table_name === '__update_tenant_modules__')) {
    const before = decodeBefore(row.before) as {
      moduleKey: string;
      row: Record<string, unknown> | null;
    };
    if (before.row)
      await restoreRow(sql, 'tenant_modules', before.row, ['tenant_id', 'module_key']);
    else
      await sql`delete from tenant_modules where tenant_id=${tenantId} and module_key=${before.moduleKey}`;
  }
  const alex = records.find((r) => r.table_name === '__update_alex_configs__');
  if (alex?.before)
    await restoreRow(sql, 'alex_configs', decodeBefore(alex.before) as Record<string, unknown>, [
      'tenant_id'
    ]);
  const tenant = records.find((r) => r.table_name === '__update_tenants__');
  if (tenant?.before)
    await restoreRow(sql, 'tenants', decodeBefore(tenant.before) as Record<string, unknown>, [
      'id'
    ]);
  await sql`delete from demo_seed_records where tenant_id=${tenantId} and seed_batch=${BATCH}`;
}

function decodeBefore(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

async function restoreRow(sql: Sql, table: string, row: Record<string, unknown>, keys: string[]) {
  const columns = Object.keys(row);
  const set = columns
    .filter((c) => !keys.includes(c))
    .map((c, i) => `"${c}"=$${i + 1}`)
    .join(',');
  const keyStart = columns.length - keys.length + 1;
  const where = keys.map((c, i) => `"${c}"=$${keyStart + i}`).join(' and ');
  const encode = (column: string, value: unknown) => {
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
  };
  const values = [
    ...columns.filter((c) => !keys.includes(c)).map((c) => encode(c, row[c])),
    ...keys.map((c) => encode(c, row[c]))
  ];
  await sql.unsafe(`update "${table}" set ${set} where ${where}`, values as never[]);
}

async function removeAgency(sql: Sql, tenantId: string) {
  const records =
    await sql`select table_name,record_id,before from demo_seed_records where tenant_id=${tenantId} and seed_batch=${BATCH}`;
  for (const table of ['agency_campaign_progress', 'agency_campaign_leads'])
    for (const row of records.filter((record) => record.table_name === table)) {
      const before = decodeBefore(row.before) as { campaignId: string; contactId: string };
      await sql.unsafe(
        `delete from "${table}" where tenant_id=$1 and campaign_id=$2 and contact_id=$3`,
        [tenantId, before.campaignId, before.contactId]
      );
    }
  for (const table of [
    'agency_invoice_drafts',
    'agency_deal_terms',
    'agency_call_attempts',
    'agency_dm_logs',
    'agency_message_drafts',
    'agency_proposals',
    'agency_contracts',
    'agency_expenses',
    'agency_referrals',
    'agency_case_studies',
    'agency_alerts',
    'agency_campaigns',
    'deal_contacts',
    'deals',
    'contacts'
  ])
    for (const row of records.filter((r) => r.table_name === table)) {
      if (table === 'agency_deal_terms') {
        const before = decodeBefore(row.before) as { dealId: string };
        await sql`delete from agency_deal_terms where tenant_id=${tenantId} and deal_id=${before.dealId}`;
      } else if (table === 'deal_contacts') {
        const before = row.before as { dealId: string; contactId: string };
        await sql`delete from deal_contacts where tenant_id=${tenantId}
          and deal_id=${before.dealId} and contact_id=${before.contactId}`;
      } else await sql.unsafe(`delete from "${table}" where id=$1`, [row.record_id]);
    }
  await sql`delete from demo_seed_records where tenant_id=${tenantId} and seed_batch=${BATCH}`;
}
