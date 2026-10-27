import { requireUser } from '../auth';
import { resolveActor } from '../auth/actor';
import { can } from '../auth/permissions';
import { loadShellContext } from '../shell';
import type { TenantContextInput } from '../tenancy';

function cookie(headers: Headers, name: string): string | undefined {
  for (const part of (headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * The tenant context for the custom fields settings page and its actions, or null when the caller
 * may not see them. Needs `tenant_data.read`; `canEdit` is `settings.business` (owner and Kynetic
 * admin, SECURITY 2.2). The tenant cookie is only a claim: a membership row backs it.
 */
export async function customFieldsScope(
  headers: Headers
): Promise<{ ctx: TenantContextInput; canEdit: boolean } | null> {
  const user = await requireUser(headers);
  const shell = await loadShellContext(headers, cookie(headers, 'tenant_id'));
  if (!shell?.tenant) return null;
  const actor = await resolveActor(user, shell.tenant.id);
  if (!can(actor, 'tenant_data.read', shell.tenant.id)) return null;
  return {
    ctx: { tenantId: shell.tenant.id, userId: user.id, role: shell.role },
    canEdit: can(actor, 'settings.business', shell.tenant.id)
  };
}
