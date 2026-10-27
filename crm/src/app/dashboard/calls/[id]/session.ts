import { requireUser, resolveActor, type Actor } from '@/server/auth';
import { loadShellContext } from '@/server/shell';
import type { TenantContextInput } from '@/server/tenancy';
import { cookies, headers } from 'next/headers';

/** The signed-in caller as the server sees them: an Actor and the tenant context for the active tenant. */
export async function callerForRequest(): Promise<{
  actor: Actor;
  ctx: TenantContextInput;
} | null> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const user = await requireUser(requestHeaders);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell?.tenant) return null;
  const actor = await resolveActor(user, shell.tenant.id);
  return { actor, ctx: { tenantId: shell.tenant.id, userId: user.id, role: shell.role } };
}
