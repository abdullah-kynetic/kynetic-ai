import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import * as schema from '../db/schema';

// Open mode (Abdullah, 2026-11-02): there is no sign-in, session, magic link, second factor or terms
// gate. Every request is treated as one of a few existing users, picked by a plain cookie so one
// person can look at the admin side and the client side. Tenant isolation (RLS), the permissions
// matrix and the audit log still apply to whichever user is picked. This must sit behind network
// access control (for example Cloudflare Access) before it faces the public internet.
export const OPEN_AS_COOKIE = 'kynetic_open_as';
export const OPEN_PERSONAS = ['admin', 'va', 'owner', 'staff'] as const;
export type OpenPersona = (typeof OPEN_PERSONAS)[number];

export function isOpenPersona(value: string | undefined | null): value is OpenPersona {
  return !!value && (OPEN_PERSONAS as readonly string[]).includes(value);
}

export function personaFromHeaders(headers: Headers): OpenPersona {
  const raw = headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === OPEN_AS_COOKIE) {
      const value = decodeURIComponent(rest.join('='));
      if (isOpenPersona(value)) return value;
    }
  }
  return 'admin';
}

export type OpenUser = {
  id: string;
  email: string;
  name: string | null;
  kyneticRole: 'admin' | 'va' | null;
};

async function staffUser(db: Db, role: 'admin' | 'va'): Promise<OpenUser | null> {
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name
    })
    .from(schema.users)
    .where(and(eq(schema.users.kyneticRole, role), isNull(schema.users.disabledAt)))
    .orderBy(asc(schema.users.email))
    .limit(1);
  return row ? { ...row, kyneticRole: role } : null;
}

async function tenantUser(db: Db, role: 'owner' | 'staff' | null): Promise<OpenUser | null> {
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      kyneticRole: schema.users.kyneticRole,
      status: schema.tenants.status
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.memberships.tenantId))
    .where(
      and(role ? eq(schema.memberships.role, role) : undefined, isNull(schema.users.disabledAt))
    )
    .orderBy(asc(schema.memberships.tenantId), asc(schema.users.email))
    .limit(20);
  const row = rows.find((r) => r.status !== 'suspended' && r.status !== 'offboarded');
  return row
    ? {
        id: row.id,
        email: row.email,
        name: row.name,
        kyneticRole: row.kyneticRole as OpenUser['kyneticRole']
      }
    : null;
}

/**
 * The user this request acts as. Falls back through the other personas when the chosen one does not
 * exist, so an empty corner of the database never locks the portal.
 */
export async function resolveOpenUser(headers: Headers, db: Db): Promise<OpenUser | null> {
  const persona = personaFromHeaders(headers);
  const tries: Array<() => Promise<OpenUser | null>> = {
    admin: [() => staffUser(db, 'admin'), () => staffUser(db, 'va')],
    va: [() => staffUser(db, 'va'), () => staffUser(db, 'admin')],
    owner: [() => tenantUser(db, 'owner'), () => tenantUser(db, 'staff')],
    staff: [() => tenantUser(db, 'staff'), () => tenantUser(db, 'owner')]
  }[persona];
  for (const attempt of [...tries, () => staffUser(db, 'admin'), () => tenantUser(db, null)]) {
    const found = await attempt();
    if (found) return found;
  }
  return null;
}
