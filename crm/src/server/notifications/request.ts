import { loadShellContext } from '../shell';
import type { TenantContextInput } from '../tenancy';

/**
 * The tenant context for the signed-in caller of a notifications route or page, or null when nobody
 * is signed in or the caller (Kynetic staff outside a tenant) has no tenant. The user id comes from
 * the session, never from the request, which is what keeps every read to "own notifications".
 */
export async function notificationContext(
  headers: Headers,
  claimedTenantId?: string
): Promise<{ signedIn: boolean; ctx: TenantContextInput | null }> {
  const shell = await loadShellContext(headers, claimedTenantId);
  if (!shell) return { signedIn: false, ctx: null };
  if (!shell.tenant) return { signedIn: true, ctx: null };
  return {
    signedIn: true,
    ctx: { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role }
  };
}
