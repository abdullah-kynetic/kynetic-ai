import { createHmac } from 'node:crypto';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';

// Staff TOTP (M0-12, F-98). The Better-Auth two-factor plugin does the enrolment and the code checks.
// Staff reach a session through Google, which the plugin's own sign-in challenge does not cover, so the
// rules here are ours: a staff session is only fully signed in once `sessions.two_factor_verified_at` is
// set, and these hooks set it. They also restrict the plugin's endpoints to staff, add a lockout and a
// replay guard that work with an existing session, and write the audit rows.

export const LOCK_AFTER_FAILURES = 5;
export const LOCK_MINUTES = 15;
const TOTP_REPLAY_TTL_SECONDS = 120;

const VERIFY_TOTP = '/two-factor/verify-totp';
const VERIFY_BACKUP = '/two-factor/verify-backup-code';
const ENABLE = '/two-factor/enable';
const REGENERATE = '/two-factor/generate-backup-codes';
// Anything else under /two-factor or /totp is refused: no disable (reset is an admin action), no
// secret URI read-back, no email or SMS codes.
const ALLOWED = new Set([ENABLE, VERIFY_TOTP, VERIFY_BACKUP, REGENERATE]);

const HASH_PREFIX = 'h1:';

/** Keyed hash of a recovery code. Codes are stored only in this form. */
export function hashRecoveryCode(secret: string, code: string): string {
  return HASH_PREFIX + createHmac('sha256', secret).update(code.trim()).digest('hex');
}

/**
 * Storage codec for the plugin's recovery codes. `encrypt` receives the JSON array of codes when they
 * are generated (plain) and again when one is spent (already hashes), so it hashes only what is not
 * hashed yet. `decrypt` returns the stored hashes; the before-hook hashes the submitted code to match.
 */
export function recoveryCodeStorage(secret: string) {
  return {
    encrypt: async (json: string) => {
      const codes = JSON.parse(json) as string[];
      return JSON.stringify(
        codes.map((c) => (c.startsWith(HASH_PREFIX) ? c : hashRecoveryCode(secret, c)))
      );
    },
    decrypt: async (stored: string) => stored
  };
}

const err = (
  status: 'UNAUTHORIZED' | 'FORBIDDEN' | 'TOO_MANY_REQUESTS',
  message: string,
  code: string
) => new APIError(status, { message, code });

type Pending = { userId: string; sessionId: string; enrolling: boolean; replayKey?: string };
const pendingKey = '__kyneticTwoFactor';

export function twoFactorHooks(db: Db, secret: string) {
  const one = async <T>(q: ReturnType<typeof sql>): Promise<T | undefined> =>
    ((await db.execute(q)) as unknown as T[])[0];

  const audit = async (userId: string, action: string, after: Record<string, unknown>) => {
    await db.execute(
      sql`select auth_record_event(${userId}::uuid, ${action}, ${JSON.stringify(after)}::jsonb)`
    );
  };

  /** Claims a TOTP code for one use. False when it was already used for this user. */
  const claimCode = (key: string) =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
      const seen = (await tx.execute(
        sql`select 1 as one from verifications where identifier = ${key} and expires_at > now()`
      )) as unknown as unknown[];
      if (seen.length > 0) return false;
      await tx.execute(sql`insert into verifications (identifier, value, expires_at)
        values (${key}, '1', now() + ${TOTP_REPLAY_TTL_SECONDS} * interval '1 second')`);
      return true;
    });

  const before = createAuthMiddleware(async (ctx) => {
    const path = ctx.path;
    if (!path.startsWith('/two-factor/') && !path.startsWith('/totp/')) return;
    if (!ALLOWED.has(path)) throw err('FORBIDDEN', 'Not available.', 'TWO_FACTOR_NOT_AVAILABLE');

    const found = await getSessionFromCtx(ctx);
    if (!found) throw err('UNAUTHORIZED', 'Sign in first.', 'NOT_SIGNED_IN');
    const userId = found.user.id;
    const user = await one<{ kynetic_role: string | null; two_factor_enabled: boolean }>(
      sql`select kynetic_role, two_factor_enabled from users where id = ${userId}`
    );
    // Two-factor is for Kynetic staff only in v1; client owners stay Later.
    if (!user?.kynetic_role) throw err('FORBIDDEN', 'Not available.', 'TWO_FACTOR_NOT_AVAILABLE');
    const session = await one<{ verified: boolean }>(
      sql`select two_factor_verified_at is not null as verified from sessions where id = ${found.session.id}`
    );

    if (path === ENABLE) {
      if (user.two_factor_enabled)
        throw err(
          'FORBIDDEN',
          'Already enrolled. Ask another admin to reset it.',
          'TWO_FACTOR_ENROLLED'
        );
      return;
    }
    if (path === REGENERATE) {
      if (!session?.verified) throw err('FORBIDDEN', 'Verify first.', 'TWO_FACTOR_REQUIRED');
      return;
    }

    // Verification. Clear an expired lock, refuse while one holds.
    await db.execute(sql`update two_factors set failed_verification_count = 0, locked_until = null
      where user_id = ${userId} and locked_until is not null and locked_until <= now()`);
    const row = await one<{ locked: boolean; verified: boolean }>(
      sql`select locked_until is not null as locked, verified from two_factors where user_id = ${userId}`
    );
    if (row?.locked) {
      await audit(userId, 'auth.2fa_failed', { reason: 'locked', path });
      throw err('TOO_MANY_REQUESTS', 'Too many attempts. Try again later.', 'TWO_FACTOR_LOCKED');
    }

    const pending: Pending = {
      userId,
      sessionId: found.session.id,
      enrolling: row ? !row.verified : false
    };
    (ctx.context as unknown as Record<string, unknown>)[pendingKey] = pending;
    const body = ctx.body as { code?: unknown };
    if (typeof body.code !== 'string') return;

    if (path === VERIFY_TOTP) {
      const key = `totp-used:${userId}:${body.code.trim()}`;
      if (!(await claimCode(key))) {
        await audit(userId, 'auth.2fa_failed', { reason: 'reused', method: 'totp' });
        throw err('UNAUTHORIZED', 'Invalid code.', 'INVALID_CODE');
      }
      pending.replayKey = key;
      return;
    }
    // Recovery codes are stored hashed, so look the submitted one up by its hash.
    return { context: { body: { ...body, code: hashRecoveryCode(secret, body.code) } } };
  });

  const after = createAuthMiddleware(async (ctx) => {
    const pending = (ctx.context as unknown as Record<string, Pending | undefined>)[pendingKey];
    if (!pending || (ctx.path !== VERIFY_TOTP && ctx.path !== VERIFY_BACKUP)) return;
    const method = ctx.path === VERIFY_TOTP ? 'totp' : 'recovery_code';
    const { userId } = pending;

    if (ctx.context.returned instanceof APIError) {
      if (pending.replayKey)
        await db.execute(sql`delete from verifications where identifier = ${pending.replayKey}`);
      const hit = await one<{ n: number; locked: boolean }>(sql`
        update two_factors
           set failed_verification_count = failed_verification_count + 1,
               locked_until = case when failed_verification_count + 1 >= ${LOCK_AFTER_FAILURES}
                                   then now() + ${LOCK_MINUTES} * interval '1 minute' else locked_until end
         where user_id = ${userId}
        returning failed_verification_count as n, locked_until is not null as locked`);
      await audit(userId, 'auth.2fa_failed', { method, attempts: hit?.n ?? null });
      if (hit?.locked) await audit(userId, 'auth.2fa_locked', { method, minutes: LOCK_MINUTES });
      return;
    }

    // Success. Enrolment swaps the session for a new one, so prefer the new session's id.
    const sessionId = ctx.context.newSession?.session.id ?? pending.sessionId;
    await db.execute(sql`update sessions set two_factor_verified_at = now()
      where id = ${sessionId} and user_id = ${userId}`);
    await db.execute(
      sql`update two_factors set failed_verification_count = 0, locked_until = null where user_id = ${userId}`
    );
    if (pending.enrolling) await audit(userId, 'auth.2fa_enrolled', { method });
    if (method === 'recovery_code') {
      const row = await one<{ backup_codes: string }>(
        sql`select backup_codes from two_factors where user_id = ${userId}`
      );
      const left = row ? (JSON.parse(row.backup_codes) as unknown[]).length : null;
      await audit(userId, 'auth.2fa_recovery_used', { remaining: left });
    }
  });

  return { before, after };
}
