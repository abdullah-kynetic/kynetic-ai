import { asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { getAuthDb } from '../db/client';
import * as schema from '../db/schema';
import { getSessionUser, type AuthUser } from '../auth';
import { loadEnabledModules, MODULE_KEYS, moduleSatisfied, type ModuleKey } from '../modules';
import type { CrmLevel } from '../modules/keys';
import { logoUrl } from '../branding';
import { withTenant } from '../tenancy';
import type { AppRole, TenantContextInput } from '../tenancy';

export type ShellRole = Extract<AppRole, 'owner' | 'staff' | 'admin' | 'va'>;

export type ShellContext = {
  user: { id: string; name: string | null; email: string };
  /** Kynetic staff keep their Kynetic role; client users carry their tenant role. */
  role: ShellRole;
  /** Null for Kynetic staff who are not acting inside a tenant. */
  tenant: { id: string; name: string; logoUrl: string | null; primaryColor: string | null } | null;
  /** Plain data for ModulesProvider (DC-057). */
  modules: { keys: ModuleKey[]; crmLevel: CrmLevel | null };
};

export type ShellDeps = {
  getUser: (headers: Headers) => Promise<AuthUser | null>;
  /** The tenants the user belongs to, active ones only, in a stable order. */
  listMemberships: (userId: string) => Promise<{ tenantId: string; role: 'owner' | 'staff' }[]>;
  loadTenant: (
    ctx: TenantContextInput
  ) => Promise<{ name: string; logoUrl: string | null; primaryColor: string | null } | null>;
  loadModules: (ctx: TenantContextInput) => Promise<ShellContext['modules']>;
};

/** Memberships through the auth connection, the same grants `resolveActor` uses. */
async function listMemberships(
  userId: string,
  db: Db = getAuthDb()
): Promise<{ tenantId: string; role: 'owner' | 'staff' }[]> {
  const rows = await db
    .select({
      tenantId: schema.memberships.tenantId,
      role: schema.memberships.role,
      status: schema.tenants.status
    })
    .from(schema.memberships)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.memberships.tenantId))
    .where(eq(schema.memberships.userId, userId))
    .orderBy(asc(schema.memberships.tenantId));
  return rows
    .filter((r) => r.status !== 'suspended' && r.status !== 'offboarded')
    .map((r) => ({ tenantId: r.tenantId, role: r.role as 'owner' | 'staff' }));
}

const defaultDeps: ShellDeps = {
  getUser: (headers) => getSessionUser(headers),
  listMemberships: (userId) => listMemberships(userId),
  loadTenant: async (ctx) => {
    const [row] = await withTenant(ctx, (tx) =>
      tx
        .select({
          name: schema.tenants.name,
          logoUrl: schema.tenants.logoUrl,
          primaryColor: schema.tenants.primaryColor
        })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, ctx.tenantId))
        .limit(1)
    );
    return row ? { ...row, logoUrl: logoUrl(row.logoUrl) } : null;
  },
  loadModules: async (ctx) => {
    const enabled = await loadEnabledModules(ctx);
    return {
      keys: MODULE_KEYS.filter((k) => moduleSatisfied(enabled, { module: k })),
      crmLevel: enabled.crmLevel
    };
  }
};

/** Platform is always on (DC-057), so a user outside any tenant still gets the base shell. */
const PLATFORM_ONLY: ShellContext['modules'] = { keys: ['platform'], crmLevel: null };

/**
 * Session to tenant for the signed-in layout. The tenant id the browser sends (`claimedTenantId`) is
 * only a claim: it counts when a membership row backs it, otherwise the user's first active tenant
 * is used. Module flags are read from the database for that tenant (SECURITY 2.4), never from the
 * request. Returns null when nobody is signed in or the user has no way into the portal; the caller redirects to sign-in.
 */
export async function loadShellContext(
  headers: Headers,
  claimedTenantId?: string,
  deps: ShellDeps = defaultDeps
): Promise<ShellContext | null> {
  const user = await deps.getUser(headers);
  if (!user) return null;

  const memberships = await deps.listMemberships(user.id);
  const membership = memberships.find((m) => m.tenantId === claimedTenantId) ?? memberships[0];
  const person = { id: user.id, name: user.name, email: user.email };

  const role: ShellRole | undefined = user.kyneticRole ?? membership?.role;
  // No Kynetic role and no active tenant (for example the only tenant is suspended): nothing to show.
  if (!role) return null;
  if (!membership) return { user: person, role, tenant: null, modules: PLATFORM_ONLY };

  const ctx: TenantContextInput = { tenantId: membership.tenantId, userId: user.id, role };
  const [tenant, modules] = await Promise.all([deps.loadTenant(ctx), deps.loadModules(ctx)]);
  return {
    user: person,
    role,
    tenant: tenant ? { id: membership.tenantId, ...tenant } : null,
    modules
  };
}

const ROLE_LABELS: Record<ShellRole, string> = {
  owner: 'Owner',
  staff: 'Team member',
  admin: 'Kynetic admin',
  va: 'Kynetic support'
};

export function roleLabel(role: ShellRole): string {
  return ROLE_LABELS[role];
}
