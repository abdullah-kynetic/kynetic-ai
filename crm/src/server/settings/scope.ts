import { requireUser } from '../auth';
import { resolveActor } from '../auth/actor';
import type { Actor } from '../auth/permissions';
import { AppError } from '../errors';
import { loadShellContext } from '../shell';
import type { TenantContextInput } from '../tenancy';

function cookie(headers: Headers, name: string): string | undefined {
  const raw = headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * Who is asking and for which tenant, for settings routes. The tenant cookie is only a claim: the
 * shell backs it with a membership row, and the actor is rebuilt from the database (SECURITY 2.1).
 */
export async function settingsScope(
  headers: Headers
): Promise<{ ctx: TenantContextInput; actor: Actor }> {
  const user = await requireUser(headers);
  const shell = await loadShellContext(headers, cookie(headers, 'tenant_id'));
  if (!shell?.tenant) throw new AppError('FORBIDDEN');
  const actor = await resolveActor(user, shell.tenant.id);
  return { ctx: { tenantId: shell.tenant.id, userId: user.id, role: shell.role }, actor };
}
