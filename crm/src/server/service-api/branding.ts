import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import type { Tx } from '../db/client';
import { tenants } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { checkPrimaryColor, normalizeHex } from '@/lib/branding/color';
import type { ServiceContext } from '../service-auth/authenticate';

// Business name and brand color for the service API (C13, part 2b). Logo upload is multipart and is
// not exposed in this step. The color must pass the portal's 3:1 contrast check, as in the portal.

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((s) => !/\p{Cc}/u.test(s), 'control_characters');

export const brandingPatchSchema = z
  .strictObject({
    name: nameSchema.optional(),
    primaryColor: z.string().nullable().optional()
  })
  .refine((v) => v.name !== undefined || v.primaryColor !== undefined, {
    message: 'Nothing to change.'
  });

export type BrandingPatch = z.input<typeof brandingPatchSchema>;

export type ServiceBranding = { name: string; primaryColor: string | null; hasLogo: boolean };

export async function getServiceBranding(tx: Tx, svc: ServiceContext): Promise<ServiceBranding> {
  const [row] = await tx
    .select({ name: tenants.name, color: tenants.primaryColor, logo: tenants.logoUrl })
    .from(tenants)
    .where(eq(tenants.id, svc.tenantId))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  return { name: row.name, primaryColor: row.color, hasLogo: Boolean(row.logo) };
}

/** Validates everything first, then writes and audits in the same transaction. */
export async function patchServiceBranding(
  tx: Tx,
  svc: ServiceContext,
  input: unknown
): Promise<ServiceBranding> {
  const parsed = brandingPatchSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({ body: ['invalid'] });
  }
  const patch = parsed.data;
  const fieldErrors: Record<string, string[]> = {};

  let color: string | null | undefined = undefined;
  if (patch.primaryColor !== undefined) {
    if (patch.primaryColor === null || patch.primaryColor.trim() === '') {
      color = null;
    } else {
      const hex = normalizeHex(patch.primaryColor);
      const check = hex ? checkPrimaryColor(hex) : null;
      if (!hex || !check) fieldErrors.primaryColor = ['invalid_hex'];
      else if (!check.ok) fieldErrors.primaryColor = ['low_contrast'];
      else color = hex;
    }
  }
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(fieldErrors);

  const before = await getServiceBranding(tx, svc);
  const set: Partial<typeof tenants.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (patch.name !== undefined) set.name = patch.name;
  if (color !== undefined) set.primaryColor = color;
  await tx.update(tenants).set(set).where(eq(tenants.id, svc.tenantId));
  const after = await getServiceBranding(tx, svc);
  await audit(tx, {
    action: 'settings.branding.update',
    entity: 'tenant',
    entityId: svc.tenantId,
    before: { name: before.name, primaryColor: before.primaryColor },
    after: { name: after.name, primaryColor: after.primaryColor }
  });
  return after;
}
