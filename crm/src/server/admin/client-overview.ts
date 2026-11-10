import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import {
  activities,
  deals,
  invitations,
  memberships,
  pipelineStages,
  pipelines,
  tenantModules,
  tenants,
  users
} from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { getGuaranteeSettings, guaranteeProgress, type GuaranteeSettings } from '../metrics';
import { MODULE_KEYS, type ModuleKey } from '../modules/keys';
import { withPlatform, withTenant } from '../tenancy';

export type ClientOverview = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: string;
    pricingTier: string | null;
    timezone: string;
    phone: string | null;
    services: string[];
    zips: string[];
    hours: string;
    goLiveAt: string | null;
  };
  owners: { name: string | null; email: string }[];
  pendingOwnerEmail: string | null;
  modules: { moduleKey: ModuleKey; enabled: boolean; level: string | null }[];
  stages: { id: string; name: string; deals: number; isWon: boolean; isLost: boolean }[];
  activity: { id: string; summary: string; type: string; occurredAt: string }[];
  guarantee: GuaranteeSettings;
};

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun'
};

export function formatBusinessHours(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const parts: string[] = [];
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    const hours = (value as Record<string, unknown>)[day];
    if (!hours || typeof hours !== 'object' || Array.isArray(hours)) continue;
    const open = (hours as { open?: unknown }).open;
    const close = (hours as { close?: unknown }).close;
    if (typeof open === 'string' && typeof close === 'string')
      parts.push(`${DAY_LABELS[day]} ${open}–${close}`);
  }
  return parts.join(', ');
}

function zipsOf(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return stringList((value as { zips?: unknown }).zips);
}

export async function loadClientOverview(
  actor: { id: string; kyneticRole: 'admin' | 'va' | null },
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<ClientOverview> {
  if (actor.kyneticRole !== 'admin' && actor.kyneticRole !== 'va') throw new AppError('FORBIDDEN');
  if (!z.uuid().safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  const ctx = { tenantId, userId: actor.id, role: actor.kyneticRole, readOnly: true as const };
  const detail = await withTenant(
    ctx,
    async (tx) => {
      const [tenant] = await tx
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          status: tenants.status,
          plan: tenants.plan,
          pricingTier: tenants.pricingTier,
          timezone: tenants.timezone,
          phone: tenants.transferNumberE164,
          services: tenants.services,
          serviceArea: tenants.serviceArea,
          businessHours: tenants.businessHours,
          goLiveAt: tenants.goLiveAt
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) throw new AppError('NOT_FOUND');
      const owners = await tx
        .select({ name: users.name, email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.tenantId, tenantId), eq(memberships.role, 'owner')));
      const [invite] = await tx
        .select({ email: invitations.email })
        .from(invitations)
        .where(
          and(
            eq(invitations.tenantId, tenantId),
            eq(invitations.role, 'owner'),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt)
          )
        )
        .limit(1);
      const stageRows = await tx
        .select({
          id: pipelineStages.id,
          name: pipelineStages.name,
          isWon: pipelineStages.isWon,
          isLost: pipelineStages.isLost
        })
        .from(pipelineStages)
        .innerJoin(pipelines, eq(pipelines.id, pipelineStages.pipelineId))
        .where(eq(pipelines.isDefault, true))
        .orderBy(asc(pipelineStages.position));
      const dealCounts = await tx
        .select({ stageId: deals.stageId, n: sql<number>`count(*)::int` })
        .from(deals)
        .where(isNull(deals.deletedAt))
        .groupBy(deals.stageId);
      const counts = new Map(dealCounts.map((row) => [row.stageId, Number(row.n)]));
      const activity = await tx
        .select({
          id: activities.id,
          summary: activities.summary,
          type: activities.type,
          occurredAt: activities.occurredAt
        })
        .from(activities)
        .orderBy(desc(activities.occurredAt))
        .limit(8);
      return {
        tenant,
        owners,
        pendingOwnerEmail: invite?.email ?? null,
        stageRows,
        counts,
        activity
      };
    },
    opts
  );
  const modules = await withTenant(
    ctx,
    (tx) =>
      tx
        .select({
          moduleKey: tenantModules.moduleKey,
          enabled: tenantModules.enabled,
          level: tenantModules.level
        })
        .from(tenantModules),
    opts
  );
  const guarantee = await getGuaranteeSettings(ctx, opts);
  const byKey = new Map(modules.map((row) => [row.moduleKey, row]));
  return {
    tenant: {
      id: detail.tenant.id,
      name: detail.tenant.name,
      slug: detail.tenant.slug,
      status: detail.tenant.status,
      plan: detail.tenant.plan,
      pricingTier: detail.tenant.pricingTier,
      timezone: detail.tenant.timezone,
      phone: detail.tenant.phone,
      services: stringList(detail.tenant.services),
      zips: zipsOf(detail.tenant.serviceArea),
      hours: formatBusinessHours(detail.tenant.businessHours),
      goLiveAt: detail.tenant.goLiveAt
    },
    owners: detail.owners,
    pendingOwnerEmail: detail.owners.length ? null : detail.pendingOwnerEmail,
    modules: MODULE_KEYS.map((moduleKey) => {
      const row = byKey.get(moduleKey);
      return {
        moduleKey,
        enabled: moduleKey === 'platform' ? true : (row?.enabled ?? false),
        level: row?.level ? row.level : null
      };
    }),
    stages: detail.stageRows.map((stage) => ({
      id: stage.id,
      name: stage.name,
      deals: detail.counts.get(stage.id) ?? 0,
      isWon: stage.isWon,
      isLost: stage.isLost
    })),
    activity: detail.activity,
    guarantee
  };
}

const baselineSchema = z.object({
  tenantId: z.uuid(),
  baseline: z.number().int().min(0).nullable(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
});

/** Stores the admin override of last month's booked appointments and the 30-day start date. */
export async function setGuaranteeBaseline(
  actor: { id: string; kyneticRole: 'admin' | 'va' | null },
  input: { tenantId: string; baseline: number | null; startDate: string | null },
  opts: { db?: Db } = {}
): Promise<void> {
  if (actor.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
  const parsed = baselineSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ guarantee: ['invalid'] });
  try {
    await withPlatform(
      { userId: actor.id, role: 'admin' },
      (tx) =>
        tx.execute(
          sql`select admin_update_tenant_commercial(${parsed.data.tenantId}::uuid, ${JSON.stringify(
            {
              guarantee_baseline_bookings: parsed.data.baseline,
              guarantee_start_date: parsed.data.startDate
            }
          )}::jsonb)`
        ),
      opts
    );
  } catch (error) {
    const code = pgCode(error);
    if (code === 'P0002') throw new AppError('NOT_FOUND', { cause: error });
    if (code === '42501') throw new AppError('FORBIDDEN', { cause: error });
    throw error;
  }
}

function pgCode(err: unknown): string | undefined {
  for (let current: unknown = err; current && typeof current === 'object';) {
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === 'string') return record.code;
    current = record.cause;
  }
  return undefined;
}

export { guaranteeProgress };
