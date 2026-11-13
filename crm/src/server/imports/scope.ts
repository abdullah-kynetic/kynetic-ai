import { requireUser } from '../auth';
import { resolveActor } from '../auth/actor';
import { can, type Actor } from '../auth/permissions';
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
 * The tenant context for a client's own import (P1-5), or null when the caller may not import
 * there. The tenant is never taken from the request body: it comes from the tenant cookie, which
 * the shell backs with a membership row, and the actor is rebuilt from the database. The caller
 * needs `import.self` for that tenant, so Kynetic staff and client staff users get null.
 */
export async function importSelfScope(
  headers: Headers
): Promise<{ ctx: TenantContextInput; actor: Actor } | null> {
  const user = await requireUser(headers);
  const shell = await loadShellContext(headers, cookie(headers, 'tenant_id'));
  if (!shell?.tenant) return null;
  const actor = await resolveActor(user, shell.tenant.id);
  if (!can(actor, 'import.self', shell.tenant.id)) return null;
  return {
    ctx: { tenantId: shell.tenant.id, userId: user.id, role: shell.role },
    actor
  };
}
