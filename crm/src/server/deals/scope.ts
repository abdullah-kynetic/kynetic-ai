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
 * The tenant context for the pipeline page and its actions, or null when the caller may not use
 * tenant data there (SECURITY 2.2 `tenant_data.read`, or `tenant_data.write` for a move). The tenant
 * cookie is only a claim: the shell backs it with a membership row and the actor is rebuilt from the
 * database. Kynetic staff outside a view-as session, and read-only view-as sessions on a write,
 * get null.
 */
export async function dealsScope(
  headers: Headers,
  access: 'read' | 'write' = 'read'
): Promise<TenantContextInput | null> {
  const user = await requireUser(headers);
  const shell = await loadShellContext(headers, cookie(headers, 'tenant_id'));
  if (!shell?.tenant) return null;
  const actor = await resolveActor(user, shell.tenant.id);
  if (!can(actor, access === 'write' ? 'tenant_data.write' : 'tenant_data.read', shell.tenant.id)) {
    return null;
  }
  return { tenantId: shell.tenant.id, userId: user.id, role: shell.role };
}
