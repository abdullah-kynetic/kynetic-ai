import { cookies, headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { isModuleEnabled } from '@/server/modules';
import { loadShellContext } from '@/server/shell';
import type { TenantContextInput } from '@/server/tenancy';

/**
 * First line of every shop page: signed in, a client selected, and `shop_ops` on. Anything else is a
 * 403 (module off) or a sign-in redirect. The data reads check the module again.
 */
export async function shopContext(): Promise<TenantContextInput> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) forbidden();
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  if (!(await isModuleEnabled(ctx, 'shop_ops'))) forbidden();
  return ctx;
}
