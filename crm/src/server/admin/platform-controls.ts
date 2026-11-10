import { desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { platformSettings, staffNotifications } from '../db/schema';
import { AppError } from '../errors';
import { getEnv } from '../env';
import { withPlatform, type PlatformContext } from '../tenancy';
import { monthStartParam, type UsageRow } from '../usage/present';

type Options = { db?: Db };

function requireAdmin(ctx: PlatformContext) {
  if (ctx.role !== 'admin') throw new AppError('FORBIDDEN');
}

export async function readOutboundPause(ctx: PlatformContext, opts: Options = {}) {
  return withPlatform(
    ctx,
    async (tx) => {
      const [row] = await tx
        .select({
          paused: platformSettings.outboundPaused,
          reason: platformSettings.reason,
          pausedAt: platformSettings.pausedAt
        })
        .from(platformSettings)
        .limit(1);
      return {
        paused: row?.paused ?? false,
        reason: row?.reason ?? null,
        pausedAt: row?.pausedAt ?? null,
        envEnabled: getEnv().OUTBOUND_ENABLED
      };
    },
    opts
  );
}

export async function setOutboundPaused(
  ctx: PlatformContext,
  paused: boolean,
  reason: string,
  opts: Options = {}
) {
  requireAdmin(ctx);
  const trimmed = reason.trim();
  if (paused && !trimmed)
    throw new AppError('VALIDATION_FAILED', { message: 'A reason is required.' });
  if (trimmed.length > 500)
    throw new AppError('VALIDATION_FAILED', { message: 'Keep the reason under 500 characters.' });
  await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select admin_set_outbound_pause(${paused}, ${paused ? trimmed : ''})`),
    opts
  );
}

export async function setMonthlySpendCap(
  ctx: PlatformContext,
  tenantId: string,
  cents: number | null,
  opts: Options = {}
) {
  requireAdmin(ctx);
  if (!z.uuid().safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  if (cents != null && (!Number.isInteger(cents) || cents < 0))
    throw new AppError('VALIDATION_FAILED', {
      message: 'Enter a cap in cents, or leave it blank.'
    });
  try {
    await withPlatform(
      ctx,
      (tx) => tx.execute(sql`select admin_set_spend_cap(${tenantId}::uuid, ${cents})`),
      opts
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (String(error).includes('P0002') || String(error).includes('tenant not found'))
      throw new AppError('NOT_FOUND');
    throw error;
  }
}

export async function setClientEmailFlags(
  ctx: PlatformContext,
  tenantId: string,
  flags: { weekly: boolean; report: boolean },
  opts: Options = {}
) {
  requireAdmin(ctx);
  if (!z.uuid().safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  await withPlatform(
    ctx,
    (tx) =>
      tx.execute(
        sql`select admin_set_client_emails(${tenantId}::uuid, ${flags.weekly}, ${flags.report})`
      ),
    opts
  );
}

export async function listUsageMonth(
  ctx: PlatformContext,
  month: string | undefined,
  opts: Options = {}
): Promise<{ month: string; rows: UsageRow[] }> {
  const start = monthStartParam(month);
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select * from admin_usage_month(${start}::date)`),
    opts
  );
  return {
    month: start.slice(0, 7),
    rows: (rows as unknown as Record<string, unknown>[]).map((row) => ({
      tenantId: String(row.tenant_id),
      tenantName: String(row.tenant_name),
      callCount: Number(row.call_count),
      callSeconds: Number(row.call_seconds),
      callCostCents: Number(row.call_cost_cents),
      smsCount: Number(row.sms_count),
      emailCount: Number(row.email_count),
      messageCostCents: Number(row.message_cost_cents),
      costUnknown: row.cost_unknown === true,
      monthlyFeeCents: row.monthly_fee_cents == null ? null : Number(row.monthly_fee_cents),
      capCents: row.cap_cents == null ? null : Number(row.cap_cents)
    }))
  };
}

export async function listStaffNotifications(ctx: PlatformContext, opts: Options = {}) {
  if (ctx.role !== 'admin') return [];
  return withPlatform(
    ctx,
    (tx) =>
      tx
        .select({
          id: staffNotifications.id,
          kind: staffNotifications.kind,
          title: staffNotifications.title,
          body: staffNotifications.body,
          createdAt: staffNotifications.createdAt
        })
        .from(staffNotifications)
        .orderBy(desc(staffNotifications.createdAt))
        .limit(20),
    opts
  );
}
