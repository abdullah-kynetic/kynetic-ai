import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getStorage, type StorageAdapter } from '../adapters/storage';
import { authorize, type Actor } from '../auth';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { tenants } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { checkPrimaryColor, normalizeHex } from '@/lib/branding/color';
import { withTenant, type TenantContextInput } from '../tenancy';
import { isLogoKey, logoKey, processLogo } from './logo';

export { processLogo, logoKey, isLogoKey } from './logo';

export type Branding = { name: string; primaryColor: string | null; logoKey: string | null };

export const LOGO_ROUTE = '/api/branding/logo';

/** Browser URL for a stored logo key; the hash in the key busts caches when the logo changes. */
export function logoUrl(value: string | null): string | null {
  if (!isLogoKey(value)) return null;
  const v = /logo-([0-9a-f]+)\.png$/.exec(value)?.[1] ?? '';
  return `${LOGO_ROUTE}?v=${v}`;
}

// No control characters, so the name is safe in titles, headers and emails.
const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((s) => !/\p{Cc}/u.test(s), 'control_characters');

export type BrandingInput = {
  name: string;
  /** Empty or null clears the color and falls back to Kynetic orange. */
  primaryColor: string | null;
  logo?: { name: string; type: string; bytes: Uint8Array } | null;
  removeLogo?: boolean;
};

type Deps = { db?: Db; storage?: StorageAdapter };

export async function getBranding(ctx: TenantContextInput, deps: Deps = {}): Promise<Branding> {
  const [row] = await withTenant(
    ctx,
    (tx) =>
      tx
        .select({ name: tenants.name, color: tenants.primaryColor, logo: tenants.logoUrl })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1),
    { db: deps.db }
  );
  if (!row) throw new AppError('NOT_FOUND');
  return {
    name: row.name,
    primaryColor: row.color,
    logoKey: isLogoKey(row.logo) ? row.logo : null
  };
}

/**
 * Saves logo, color and name for the actor's tenant (F-39). Validation happens before anything is
 * written: a bad file or a color under 3:1 changes nothing. The audit row commits with the update.
 */
export async function saveBranding(
  ctx: TenantContextInput,
  actor: Actor,
  input: BrandingInput,
  deps: Deps = {}
): Promise<Branding> {
  authorize(actor, 'settings.business', ctx.tenantId);

  const fieldErrors: Record<string, string[]> = {};
  const name = nameSchema.safeParse(input.name);
  if (!name.success) fieldErrors.name = ['invalid'];

  let color: string | null = null;
  if (input.primaryColor && input.primaryColor.trim()) {
    const hex = normalizeHex(input.primaryColor);
    const check = hex ? checkPrimaryColor(hex) : null;
    if (!hex || !check) fieldErrors.primaryColor = ['invalid_hex'];
    else if (!check.ok) fieldErrors.primaryColor = ['low_contrast'];
    else color = hex;
  }

  let logo: Awaited<ReturnType<typeof processLogo>> | null = null;
  if (input.logo) {
    try {
      logo = await processLogo(input.logo);
    } catch (e) {
      if (e instanceof ValidationError) Object.assign(fieldErrors, e.fieldErrors);
      else throw e;
    }
  }
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(fieldErrors);

  const storage = deps.storage ?? getStorage();
  const newKey = logo ? logoKey(ctx.tenantId, logo.hash) : null;
  if (logo && newKey) await storage.put(newKey, logo.body, { contentType: logo.contentType });

  const { before, after } = await withTenant(
    ctx,
    async (tx) => {
      const [prev] = await tx
        .select({ name: tenants.name, color: tenants.primaryColor, logo: tenants.logoUrl })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);
      if (!prev) throw new AppError('NOT_FOUND');
      const nextLogo = newKey ?? (input.removeLogo ? null : prev.logo);
      await tx
        .update(tenants)
        .set({ name: name.data!, primaryColor: color, logoUrl: nextLogo })
        .where(eq(tenants.id, ctx.tenantId));
      const b = { name: prev.name, primaryColor: prev.color, logo: prev.logo };
      const a = { name: name.data!, primaryColor: color, logo: nextLogo };
      await audit(tx, {
        action: 'branding.update',
        entity: 'tenant',
        entityId: ctx.tenantId,
        before: b,
        after: a
      });
      return { before: b, after: a };
    },
    { db: deps.db }
  );

  // The old file is only dropped once the new row has committed.
  if (isLogoKey(before.logo) && before.logo !== after.logo) {
    await storage.remove(before.logo).catch(() => undefined);
  }
  return {
    name: after.name,
    primaryColor: after.primaryColor,
    logoKey: isLogoKey(after.logo) ? after.logo : null
  };
}
