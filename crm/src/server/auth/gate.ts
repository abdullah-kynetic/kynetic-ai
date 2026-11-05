import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';

export type GateDecision =
  | { allowed: true; staff: boolean }
  | { allowed: false; reason: 'no_membership' | 'disabled' };

type Row = { id: string; disabled: boolean; staff: boolean; has_membership: boolean };

/**
 * Who may sign in (F-71). A person may sign in when they are a Kynetic staff user, belong to a
 * tenant, or hold a pending invitation (the accept page then creates the membership). Everyone else
 * is refused, including a Google account nobody invited. Reads only the columns kynetic_auth is
 * granted, so it works on the auth connection.
 */
export async function evaluateGate(db: Db, email: string): Promise<GateDecision> {
  const normalized = email.trim().toLowerCase();
  const rows = (await db.execute(sql`
    select u.id,
           u.disabled_at is not null as disabled,
           u.kynetic_role is not null as staff,
           exists (select 1 from memberships m where m.user_id = u.id) as has_membership
      from users u where u.email = ${normalized}`)) as unknown as Row[];
  const user = rows[0];
  if (user?.disabled) return { allowed: false, reason: 'disabled' };
  if (user?.staff) return { allowed: true, staff: true };
  if (user?.has_membership) return { allowed: true, staff: false };
  const invited = (await db.execute(sql`
    select 1 as one from invitations
     where email = ${normalized} and accepted_at is null and revoked_at is null and expires_at > now()
     limit 1`)) as unknown as unknown[];
  return invited.length > 0
    ? { allowed: true, staff: false }
    : { allowed: false, reason: 'no_membership' };
}

/** Staff sign in with Google (plus TOTP, M0-12); the email link is for client users only. */
export async function isStaffEmail(db: Db, email: string): Promise<boolean> {
  const rows = (await db.execute(
    sql`select 1 as one from users where email = ${email.trim().toLowerCase()} and kynetic_role is not null`
  )) as unknown as unknown[];
  return rows.length > 0;
}
