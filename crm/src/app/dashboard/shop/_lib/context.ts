import { cookies, headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { isModuleEnabled } from '@/server/modules';
import { loadShellContext } from '@/server/shell';
import type { TenantContextInput } from '@/server/tenancy';

/**
 * First line of every shop page: signed in, a client selected, and `shop_ops` on. Anything else is a
 * 403 (module off) or a sign-in redirect. The data reads check the module again. While Kynetic staff
 * are viewing a client (View as client), the context is that client's and is read-only.
 */
export async function shopContext(): Promise<TenantContextInput> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(
    requestHeaders,
    cookieStore.get('tenant_id')?.value,
    undefined,
    cookieStore.get(VIEW_AS_COOKIE)?.value
  );
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) forbidden();
  const ctx: TenantContextInput = {
    tenantId: shell.tenant.id,
    userId: shell.user.id,
    role: shell.role,
    ...(shell.viewAs ? { readOnly: true } : {})
  };
  if (!(await isModuleEnabled(ctx, 'shop_ops'))) forbidden();
  return ctx;
}
