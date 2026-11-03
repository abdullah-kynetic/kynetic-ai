import { loadShellContext } from '@/server/shell';
import { ModuleDisabledError, requireModule } from '@/server/modules';
import type { TenantContextInput } from '@/server/tenancy';
import { cookies, headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';

/**
 * Who is asking and for which tenant, for the companies pages and actions. Order follows CODE_STYLE
 * "Mutation order": sign-in, tenant, then the `crm` module (a tenant without it gets the 403 page and
 * nothing runs). View-as for Kynetic staff is not built yet (M8a), so only the tenant's own people
 * get in; everyone else is refused.
 */
export async function companiesContext(): Promise<TenantContextInput> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant || (shell.role !== 'owner' && shell.role !== 'staff')) forbidden();
  const ctx: TenantContextInput = {
    tenantId: shell.tenant.id,
    userId: shell.user.id,
    role: shell.role
  };
  try {
    await requireModule(ctx, 'crm');
  } catch (e) {
    if (e instanceof ModuleDisabledError) forbidden();
    throw e;
  }
  return ctx;
}
