import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Tx } from '../db/client';
import { AppError } from '../errors';
import { MAX_REPORT_DAY, MIN_REPORT_DAY, readReportSchedule } from '../schedules';
import type { TenantContextInput } from '../tenancy';
import type { StaffCaller } from './users';
import { asTenantAdmin } from './tenant-admin';

const daySchema = z.number().int().min(MIN_REPORT_DAY).max(MAX_REPORT_DAY);

export async function getReportScheduleForAdmin(
  caller: StaffCaller,
  tenantId: string,
  opts: { db?: Db } = {}
) {
  return asTenantAdmin(caller, tenantId, opts, async () => {
    const ctx: TenantContextInput = { tenantId, userId: caller.id, role: 'admin' };
    return readReportSchedule(ctx, opts);
  });
}

export async function setReportDay(
  caller: StaffCaller,
  tenantId: string,
  day: number,
  opts: { db?: Db } = {}
) {
  const parsed = daySchema.safeParse(day);
  if (!parsed.success)
    throw new AppError('VALIDATION_FAILED', { message: 'Choose a day from 1 to 28.' });
  return asTenantAdmin(caller, tenantId, opts, async (tx) => {
    await setPlatformSetting(tx, tenantId, 'reportDayOfMonth', parsed.data);
    return { day: parsed.data };
  });
}

export async function setPlatformSetting(
  tx: Tx,
  tenantId: string,
  key: 'reportDayOfMonth' | 'n8nWebhookUrl',
  value: string | number | null
) {
  try {
    await tx.execute(
      sql`select admin_set_platform_setting(${tenantId}::uuid, ${key}, ${value === null ? null : JSON.stringify(value)}::jsonb)`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('tenant not found')) throw new AppError('NOT_FOUND');
    if (
      message.includes('not editable') ||
      message.includes('report day') ||
      message.includes('webhook url')
    ) {
      throw new AppError('VALIDATION_FAILED', { message: 'That setting is not valid.' });
    }
    throw error;
  }
}
