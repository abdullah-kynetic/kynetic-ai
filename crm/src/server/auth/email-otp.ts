import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { serializeSignedCookie } from 'better-call';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { evaluateGate } from './gate';
import { SESSION_EXPIRES_IN_SECONDS } from './lifetimes';
import type { Auth } from './create-auth';

export const EMAIL_OTP_TTL_SECONDS = 10 * 60;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;

/** Shown for every address. The page must not say whether an account or invite exists. */
export const EMAIL_CODE_SENT_MESSAGE =
  'If you have access, we sent a code to that email. It expires in 10 minutes.';
export const EMAIL_CODE_FAILED_MESSAGE = 'That code did not work. Request a new one.';

export type SignInCodeMessage = { email: string; code: string };

export type EmailOtpDeps = {
  db: Db;
  secret: string;
  baseUrl: string;
  auth: Auth;
  sendCode: (msg: SignInCodeMessage) => Promise<void>;
  /** STAFF_EMAIL_LOGIN: staff may use an emailed code instead of Google and an authenticator. */
  staffEmailLogin?: boolean;
};

export type EmailOtpVerifyResult =
  | {
      ok: true;
      next: '/admin' | '/dashboard' | '/sign-up/profile';
      setCookie: string;
    }
  | { ok: false; message: string };

const sent = (): { ok: true; message: string } => ({
  ok: true,
  message: EMAIL_CODE_SENT_MESSAGE
});
const failed = (): EmailOtpVerifyResult => ({
  ok: false,
  message: EMAIL_CODE_FAILED_MESSAGE
});

function emailHash(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

function otpIdentifier(email: string): string {
  return `email-otp:${emailHash(email)}`;
}

function codeMac(secret: string, code: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

function sameMac(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionCookieName(baseUrl: string): string {
  return baseUrl.startsWith('https://')
    ? '__Host-kynetic.session_token'
    : 'better-auth.session_token';
}

async function auditOtp(
  db: Db,
  email: string,
  action: 'auth.otp_sent' | 'auth.otp_suppressed' | 'auth.otp_failed' | 'auth.otp_verified',
  after: Record<string, string | number | boolean | null>
): Promise<void> {
  const rows = (await db.execute(sql`select id from users where email = ${email}`)) as unknown as {
    id: string;
  }[];
  const userId = rows[0]?.id ?? null;
  await db.execute(
    sql`select auth_record_otp(${action}, ${userId}::uuid, ${JSON.stringify({ ...after, email_hash: emailHash(email) })}::jsonb)`
  );
}

/**
 * Sends a 6-digit code only when the address has an active membership or a live invitation,
 * and is not staff. Every other address gets the same result and no email.
 */
export async function requestEmailOtp(
  deps: EmailOtpDeps,
  email: string
): Promise<{ ok: true; message: string }> {
  const normalized = email.trim().toLowerCase();
  const gate = await evaluateGate(deps.db, normalized);
  if (!gate.allowed || (gate.staff && !deps.staffEmailLogin)) {
    await auditOtp(deps.db, normalized, 'auth.otp_suppressed', {
      reason: gate.allowed ? 'staff' : gate.reason
    });
    return sent();
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const identifier = otpIdentifier(normalized);
  const stored = `v1:${codeMac(deps.secret, code)}:0`;
  await deps.db.execute(sql`delete from verifications where identifier = ${identifier}`);
  await deps.db.execute(sql`
    insert into verifications (identifier, value, expires_at)
    values (${identifier}, ${stored}, now() + ${EMAIL_OTP_TTL_SECONDS} * interval '1 second')
  `);

  try {
    await deps.sendCode({ email: normalized, code });
  } catch {
    await deps.db.execute(sql`delete from verifications where identifier = ${identifier}`);
    await auditOtp(deps.db, normalized, 'auth.otp_suppressed', {
      reason: 'send_failed'
    });
    return sent();
  }

  await auditOtp(deps.db, normalized, 'auth.otp_sent', {});
  return sent();
}

type Consume = { ok: true } | { ok: false; reason: 'missing' | 'expired' | 'locked' | 'mismatch' };

async function consumeCode(deps: EmailOtpDeps, email: string, code: string): Promise<Consume> {
  const identifier = otpIdentifier(email);
  return deps.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identifier}))`);
    const rows = (await tx.execute(
      sql`select value, expires_at from verifications where identifier = ${identifier} for update`
    )) as unknown as { value: string; expires_at: Date | string }[];
    const row = rows[0];
    if (!row) return { ok: false, reason: 'missing' };
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await tx.execute(sql`delete from verifications where identifier = ${identifier}`);
      return { ok: false, reason: 'expired' };
    }
    const parsed = /^v1:([0-9a-f]{64}):(\d+)$/.exec(row.value);
    if (!parsed) {
      await tx.execute(sql`delete from verifications where identifier = ${identifier}`);
      return { ok: false, reason: 'mismatch' };
    }
    const attempts = Number(parsed[2]);
    if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      await tx.execute(sql`delete from verifications where identifier = ${identifier}`);
      return { ok: false, reason: 'locked' };
    }
    const expected = parsed[1] ?? '';
    const matches = /^\d{6}$/.test(code) && sameMac(expected, codeMac(deps.secret, code));
    if (!matches) {
      const next = attempts + 1;
      if (next >= EMAIL_OTP_MAX_ATTEMPTS) {
        await tx.execute(sql`delete from verifications where identifier = ${identifier}`);
        return { ok: false, reason: 'locked' };
      }
      await tx.execute(
        sql`update verifications set value = ${`v1:${expected}:${next}`}, updated_at = now() where identifier = ${identifier}`
      );
      return { ok: false, reason: 'mismatch' };
    }
    await tx.execute(sql`delete from verifications where identifier = ${identifier}`);
    return { ok: true };
  });
}

/**
 * Checks a code, opens a session for an allowed client address, and accepts pending invitations.
 * Failures share one message. Staff only get a session from a code when STAFF_EMAIL_LOGIN is on.
 */
export async function verifyEmailOtp(
  deps: EmailOtpDeps,
  email: string,
  code: string
): Promise<EmailOtpVerifyResult> {
  const normalized = email.trim().toLowerCase();
  const consumed = await consumeCode(deps, normalized, code);
  if (!consumed.ok) {
    await auditOtp(deps.db, normalized, 'auth.otp_failed', {
      reason: consumed.reason
    });
    return failed();
  }

  const gate = await evaluateGate(deps.db, normalized);
  if (!gate.allowed || (gate.staff && !deps.staffEmailLogin)) {
    await auditOtp(deps.db, normalized, 'auth.otp_failed', {
      reason: gate.allowed ? 'staff' : gate.reason
    });
    return failed();
  }

  const ctx = await deps.auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(normalized);
  let user = existing?.user ?? null;
  try {
    if (!user) {
      user = await ctx.internalAdapter.createUser(
        {
          email: normalized,
          name: '',
          emailVerified: true
        },
        { method: 'email-otp' }
      );
    } else if (!user.emailVerified) {
      user = await ctx.internalAdapter.updateUser(user.id, {
        emailVerified: true
      });
    }
    await deps.db.execute(sql`select accept_pending_invitations(${user.id}::uuid)`);
    const session = await ctx.internalAdapter.createSession(user.id);
    const secure = deps.baseUrl.startsWith('https://');
    const setCookie = await serializeSignedCookie(
      sessionCookieName(deps.baseUrl),
      session.token,
      ctx.secret,
      {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: SESSION_EXPIRES_IN_SECONDS
      }
    );
    await auditOtp(deps.db, normalized, 'auth.otp_verified', {});
    const name = typeof user.name === 'string' ? user.name.trim() : '';
    // Kynetic staff land on the admin side; everyone else on their own workspace.
    const home = gate.staff ? '/admin' : '/dashboard';
    return {
      ok: true,
      next: name.length > 0 ? home : '/sign-up/profile',
      setCookie
    };
  } catch {
    await auditOtp(deps.db, normalized, 'auth.otp_failed', {
      reason: 'rejected'
    });
    return failed();
  }
}
