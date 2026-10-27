'use server';

import { requireUser, resolveActor } from '@/server/auth';
import { saveBranding } from '@/server/branding';
import { checkPrimaryColor } from '@/lib/branding/color';
import { AppError } from '@/server/errors';
import { loadShellContext } from '@/server/shell';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type BrandingResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]>; suggestion?: string };

const MESSAGES: Record<string, string> = {
  too_big: 'The logo is larger than 1 MB.',
  empty: 'The logo file is empty.',
  svg_not_allowed: 'SVG logos are not accepted. Use a PNG, JPEG or WebP.',
  unsupported_type: 'The logo must be a PNG, JPEG or WebP.',
  mime_mismatch: 'The file type does not match its contents.',
  extension_mismatch: 'The file name does not match its contents.',
  dimensions_too_big: 'The logo is larger than 4096 by 4096 pixels.',
  unreadable: 'The logo could not be read as an image.'
};

export async function saveBrandingAction(formData: FormData): Promise<BrandingResult> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const user = await requireUser(requestHeaders);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell?.tenant) return { ok: false, message: 'You do not have access to this.' };
  const actor = await resolveActor(user, shell.tenant.id);

  const color = String(formData.get('primaryColor') ?? '').trim();
  const file = formData.get('logo');
  const logo =
    file instanceof File && file.size > 0
      ? { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }
      : null;
  try {
    await saveBranding({ tenantId: shell.tenant.id, userId: user.id, role: shell.role }, actor, {
      name: String(formData.get('name') ?? ''),
      primaryColor: color || null,
      logo,
      removeLogo: formData.get('removeLogo') === 'on'
    });
  } catch (e) {
    if (e instanceof AppError) {
      const fe = e.fieldErrors ?? {};
      const check = color ? checkPrimaryColor(color) : null;
      const message = fe.logo?.[0]
        ? (MESSAGES[fe.logo[0]] ?? 'The logo is not valid.')
        : fe.primaryColor?.[0] === 'low_contrast' && check
          ? `Too ${check.ratios.light < 3 ? 'light' : 'dark'} for buttons (${Math.min(check.ratios.light, check.ratios.dark).toFixed(2)}:1, needs 3:1).`
          : fe.primaryColor
            ? 'Enter the color as #rrggbb.'
            : fe.name
              ? 'Enter a business name of 1 to 80 characters.'
              : e.message;
      return { ok: false, message, fieldErrors: fe, suggestion: check?.suggestion };
    }
    throw e;
  }
  revalidatePath('/dashboard', 'layout');
  return { ok: true };
}
