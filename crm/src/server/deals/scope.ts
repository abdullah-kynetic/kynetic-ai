import { can } from '../auth/permissions';
import { AppError } from '../errors';
import { requestScope } from '../shell';
import type { TenantContextInput } from '../tenancy';

/**
 * The tenant context for the pipeline page and its actions, or null when the caller may not use
 * tenant data there (SECURITY 2.2 `tenant_data.read`, or `tenant_data.write` for a move). Kynetic
 * staff outside a view-as session, and read-only view-as sessions on a write, get null.
 */
export async function dealsScope(
  headers: Headers,
  access: 'read' | 'write' = 'read'
): Promise<TenantContextInput | null> {
  let scope: Awaited<ReturnType<typeof requestScope>>;
  try {
    scope = await requestScope(headers);
  } catch (e) {
    if (e instanceof AppError && e.code === 'FORBIDDEN') return null;
    throw e;
  }
  const { ctx, actor } = scope;
  return can(actor, access === 'write' ? 'tenant_data.write' : 'tenant_data.read', ctx.tenantId)
    ? ctx
    : null;
}

/** Stage settings pages and routes: the caller's tenant and actor; the service checks permission. */
export const stageScope = requestScope;
