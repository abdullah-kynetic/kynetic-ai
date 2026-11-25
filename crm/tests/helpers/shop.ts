import type postgres from 'postgres';

type Sql = postgres.Sql;

export const SHOP_STAGES = [
  ['New lead', 5, false, false],
  ['Quoted', 25, false, false],
  ['Waiting on insurance', 45, false, false],
  ['Parts ordered', 65, false, false],
  ['In repair and paint', 85, false, false],
  ['Ready for pickup', 95, false, false],
  ['Picked up', 100, true, false],
  ['Lost', 0, false, true]
] as const;

export type ShopJobInput = {
  title: string;
  stage: (typeof SHOP_STAGES)[number][0];
  customer: string;
  valueCents?: number;
  ownerId?: string | null;
  custom?: Record<string, unknown>;
  createdAt?: string;
  wonAt?: string | null;
};

/**
 * Replaces the tenant's default pipeline stages with the eight auto body stages, then adds jobs.
 * Test fixture only; it writes through the admin connection.
 */
export async function seedShopPipeline(
  admin: Sql,
  tenantId: string,
  jobs: ShopJobInput[]
): Promise<{ stageIds: Record<string, string>; dealIds: string[] }> {
  await admin`delete from deal_contacts where tenant_id = ${tenantId}`;
  await admin`delete from appointments where tenant_id = ${tenantId}`;
  await admin`update calls set deal_id = null where tenant_id = ${tenantId}`;
  await admin`update tasks set deal_id = null where tenant_id = ${tenantId}`;
  await admin`delete from activities where tenant_id = ${tenantId} and deal_id is not null`;
  await admin`delete from deals where tenant_id = ${tenantId}`;
  const [pipeline] =
    await admin`select id from pipelines where tenant_id = ${tenantId} and is_default`;
  await admin`delete from pipeline_stages where tenant_id = ${tenantId} and pipeline_id = ${pipeline!.id}`;
  const stageIds: Record<string, string> = {};
  for (const [i, [name, probability, isWon, isLost]] of SHOP_STAGES.entries()) {
    const [row] = await admin`insert into pipeline_stages
      (tenant_id, pipeline_id, name, position, probability, is_won, is_lost)
      values (${tenantId}, ${pipeline!.id}, ${name}, ${i}, ${probability}, ${isWon}, ${isLost})
      returning id`;
    stageIds[name] = row!.id;
  }
  const dealIds: string[] = [];
  for (const [i, job] of jobs.entries()) {
    const [first, ...rest] = job.customer.split(' ');
    const [contact] = await admin`insert into contacts
      (tenant_id, first_name, last_name, phones, emails, primary_phone_e164)
      values (${tenantId}, ${first!}, ${rest.join(' ') || null}, ${[`+1214555${String(1000 + i)}`]},
        ${['']}, ${`+1214555${String(1000 + i)}`}) returning id`;
    const created = job.createdAt ?? new Date().toISOString();
    const [deal] = await admin`insert into deals
      (tenant_id, pipeline_id, stage_id, title, value_cents, owner_id, custom, position, created_at, updated_at, won_at)
      values (${tenantId}, ${pipeline!.id}, ${stageIds[job.stage]!}, ${job.title}, ${job.valueCents ?? 0},
        ${job.ownerId ?? null}, ${admin.json((job.custom ?? {}) as never)}, ${`a${i}`}, ${created}, ${created},
        ${job.wonAt ?? null}) returning id`;
    await admin`insert into deal_contacts (tenant_id, deal_id, contact_id, role)
      values (${tenantId}, ${deal!.id}, ${contact!.id}, 'homeowner')`;
    dealIds.push(deal!.id);
  }
  return { stageIds, dealIds };
}
