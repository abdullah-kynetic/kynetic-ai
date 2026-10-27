import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { tenants } from '../db/schema';
import { AppError } from '../errors';
import { can, type Actor } from '../auth/permissions';
import { audit } from '../audit';
import { withTenant, type TenantContextInput } from '../tenancy';
import { e164Schema, parseInput } from '../validation';
import {
  businessHoursSchema,
  isValidTimeZone,
  serviceAreaSchema,
  servicesSchema,
  type BusinessHours,
  type ServiceArea
} from './hours';

export type BusinessSettings = {
  timezone: string;
  businessHours: BusinessHours;
  serviceArea: ServiceArea | Record<string, never>;
  services: string[];
  transferNumber: string | null;
};

/** Every field optional; unknown keys are refused so a caller cannot reach plan or status (F-41). */
export const businessSettingsPatchSchema = z
  .object({
    timezone: z.string().refine(isValidTimeZone, 'invalid_timezone'),
    businessHours: businessHoursSchema,
    serviceArea: serviceAreaSchema,
    services: servicesSchema,
    transferNumber: e164Schema.nullable()
  })
  .partial()
  .strict();
export type BusinessSettingsPatch = z.infer<typeof businessSettingsPatchSchema>;

function requireBusinessWrite(actor: Actor, tenantId: string) {
  if (!can(actor, 'settings.business', tenantId)) throw new AppError('FORBIDDEN');
}

const columns = {
  timezone: tenants.timezone,
  businessHours: tenants.businessHours,
  serviceArea: tenants.serviceArea,
  services: tenants.services,
  transferNumber: tenants.transferNumberE164
};

/** Anyone in the tenant can read (the booking API and call windows need it); only the write is gated. */
export async function getBusinessSettings(
  ctx: TenantContextInput,
  opts: { db?: Db } = {}
): Promise<BusinessSettings> {
  const [row] = await withTenant(
    ctx,
    (tx) => tx.select(columns).from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1),
    opts
  );
  if (!row) throw new AppError('NOT_FOUND');
  return row as BusinessSettings;
}

/** Owner (or Kynetic admin in a write view-as) updates business settings; the change is audited. */
export async function updateBusinessSettings(
  ctx: TenantContextInput,
  actor: Actor,
  input: unknown,
  opts: { db?: Db } = {}
): Promise<BusinessSettings> {
  requireBusinessWrite(actor, ctx.tenantId);
  const patch = parseInput(businessSettingsPatchSchema, input);
  return withTenant(
    ctx,
    async (tx) => {
      const [before] = await tx.select(columns).from(tenants).where(eq(tenants.id, ctx.tenantId));
      if (!before) throw new AppError('NOT_FOUND');
      const set: Partial<typeof tenants.$inferInsert> = { updatedAt: new Date().toISOString() };
      if (patch.timezone !== undefined) set.timezone = patch.timezone;
      if (patch.businessHours !== undefined) set.businessHours = patch.businessHours;
      if (patch.serviceArea !== undefined) set.serviceArea = patch.serviceArea;
      if (patch.services !== undefined) set.services = patch.services;
      if (patch.transferNumber !== undefined) set.transferNumberE164 = patch.transferNumber;
      const [after] = await tx
        .update(tenants)
        .set(set)
        .where(eq(tenants.id, ctx.tenantId))
        .returning(columns);
      await audit(tx, {
        action: 'settings.business.update',
        entity: 'tenant',
        entityId: ctx.tenantId,
        before,
        after
      });
      return after as BusinessSettings;
    },
    opts
  );
}
