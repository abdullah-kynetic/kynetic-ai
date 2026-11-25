'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { audit } from '@/server/audit';
import { AppError } from '@/server/errors';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { loadShellContext } from '@/server/shell';
import { approveReviewReply } from '@/server/shop';
import { withTenant } from '@/server/tenancy';

/** Marks a drafted reply approved in the portal. It posts nothing anywhere. */
export async function approveReplyAction(formData: FormData): Promise<void> {
  const id = formData.get('id');
  if (typeof id !== 'string' || !id) throw new AppError('VALIDATION_FAILED');
  const [h, c] = await Promise.all([headers(), cookies()]);
  const shell = await loadShellContext(
    h,
    c.get('tenant_id')?.value,
    undefined,
    c.get(VIEW_AS_COOKIE)?.value
  );
  if (!shell?.tenant) throw new Error('unauthorized');
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  if (shell.viewAs?.readOnly) {
    await withTenant(ctx, (tx) =>
      audit(tx, { action: 'viewas.write_denied', entity: 'presence_item' })
    );
    throw new AppError('FORBIDDEN');
  }
  await approveReviewReply(ctx, id);
  revalidatePath('/dashboard/shop/reviews');
}
