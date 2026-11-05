import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { withPlatform } from '../tenancy';

/**
 * An admin resets another staff member's TOTP (F-98, F-101). The database function refuses a non-admin
 * caller and your own account, deletes the secret and recovery codes, signs the person out everywhere
 * and writes the audit row. The target enrols again at their next sign-in.
 *
 * `notify` tells the person it happened (SECURITY 2.5). It runs after the reset commits.
 */
export async function resetStaffTwoFactor(
  actor: { id: string; kyneticRole: 'admin' | 'va' | null },
  targetUserId: string,
  opts: { db?: Db; notify?: (userId: string) => Promise<void> } = {}
): Promise<void> {
  if (actor.kyneticRole !== 'admin') throw new Error('Only an admin can reset two-factor');
  await withPlatform(
    { userId: actor.id, role: 'admin' },
    (tx) => tx.execute(sql`select admin_reset_staff_two_factor(${targetUserId}::uuid)`),
    { db: opts.db }
  );
  await opts.notify?.(targetUserId);
}
