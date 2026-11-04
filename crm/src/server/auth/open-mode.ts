import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import * as schema from '../db/schema';

import { getEnv, type Env } from '../env';

// Persona switching is a local development aid, never authentication or a production feature.
export function personaSwitchingEnabled(
  env: Pick<Env, 'NODE_ENV' | 'DEV_PERSONA_SWITCHING'> = getEnv()
): boolean {
  return env.NODE_ENV !== 'production' && env.DEV_PERSONA_SWITCHING === true;
}

export const OPEN_AS_COOKIE = 'kynetic_open_as';
export const OPEN_PERSONAS = ['admin', 'va', 'owner', 'staff'] as const;
export type OpenPersona = (typeof OPEN_PERSONAS)[number];

export function isOpenPersona(value: string | undefined | null): value is OpenPersona {
  return !!value && (OPEN_PERSONAS as readonly string[]).includes(value);
}

export function personaFromHeaders(headers: Headers): OpenPersona | null {
  const raw = headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === OPEN_AS_COOKIE) {
      try {
        const value = decodeURIComponent(rest.join('='));
        return isOpenPersona(value) ? value : null;
      } catch {
        return null;
      }
    }
  }
  return null;
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

/** Exact selected persona only, with no fallback or elevation to another user/role. */
export async function resolveOpenUser(headers: Headers, db: Db): Promise<OpenUser | null> {
  if (!personaSwitchingEnabled()) return null;
  const persona = personaFromHeaders(headers);
  if (!persona) return null;
  return persona === 'admin' || persona === 'va' ? staffUser(db, persona) : tenantUser(db, persona);
}
