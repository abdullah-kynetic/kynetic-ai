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
 * The tenant context for a contacts page, or null when the caller may not read tenant data there
 * (SECURITY 2.2 `tenant_data.read`). The tenant cookie is only a claim: the shell backs it with a
 * membership row and the actor is rebuilt from the database. Kynetic staff outside a view-as session
 * get null, so the page shows no client data.
 */
export async function contactsScope(headers: Headers): Promise<TenantContextInput | null> {
  return (await contactsActorScope(headers))?.ctx ?? null;
}

/** The same scope plus the actor, for writes that check the permission matrix (bulk actions, F-08). */
export async function contactsActorScope(
  headers: Headers
): Promise<{ ctx: TenantContextInput; actor: Actor } | null> {
  const user = await requireUser(headers);
  const shell = await loadShellContext(headers, cookie(headers, 'tenant_id'));
  if (!shell?.tenant) return null;
  const actor = await resolveActor(user, shell.tenant.id);
  if (!can(actor, 'tenant_data.read', shell.tenant.id)) return null;
  return {
    ctx: { tenantId: shell.tenant.id, userId: user.id, role: shell.role },
    actor
  };
}
