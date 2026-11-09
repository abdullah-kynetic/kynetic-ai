import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSessionUser, type Auth } from '@/server/auth';
import {
  EMAIL_CODE_FAILED_MESSAGE,
  EMAIL_CODE_SENT_MESSAGE,
  requestEmailOtp,
  verifyEmailOtp,
  type SignInCodeMessage
} from '@/server/auth/email-otp';
import { createAuth } from '@/server/auth/create-auth';
import { createDb } from '@/server/db/client';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let auth: Auth;
let sent: SignInCodeMessage[] = [];
const BASE = 'http://localhost:3000';
const SECRET = 'integration-test-secret-0123456789abcdef';

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
  auth = createAuth({
    db: createDb(db.auth),
    baseUrl: BASE,
    secret: SECRET,
    sendMagicLink: async () => {}
  });
});
afterAll(async () => {
  await db?.drop();
});

const deps = () => ({
  db: createDb(db.auth),
  secret: SECRET,
  baseUrl: BASE,
  auth,
  sendCode: async (msg: SignInCodeMessage) => {
    sent.push(msg);
  }
});

async function request(email: string): Promise<string | undefined> {
  sent = [];
  const result = await requestEmailOtp(deps(), email);
  expect(result).toEqual({ ok: true, message: EMAIL_CODE_SENT_MESSAGE });
  return sent[0]?.code;
}

function cookieHeader(setCookie: string): Headers {
  const pair = setCookie.split(';')[0] ?? '';
  const eq = pair.indexOf('=');
  const name = pair.slice(0, eq);
  const value = decodeURIComponent(pair.slice(eq + 1));
  return new Headers({ cookie: `${name}=${value}` });
}

describe('client email code sign-in', () => {
  it('sends a code only for a member, then opens a session', async () => {
    await db.admin`update users set name = 'Owner A' where id = ${IDS.ownerA}`;
    const code = await request('Owner-A@example.test');
    expect(code).toMatch(/^\d{6}$/);
    const rows =
      await db.admin`select value from verifications where identifier like 'email-otp:%'`;
    expect(rows.map((row) => row.value).join(' ')).not.toContain(code);

    const verified = await verifyEmailOtp(deps(), 'owner-a@example.test', code!);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.next).toBe('/dashboard');
    const user = await getSessionUser(cookieHeader(verified.setCookie), {
      auth,
      db: createDb(db.auth)
    });
    expect(user).toMatchObject({ id: IDS.ownerA, email: 'owner-a@example.test' });

    const again = await verifyEmailOtp(deps(), 'owner-a@example.test', code!);
    expect(again).toEqual({ ok: false, message: EMAIL_CODE_FAILED_MESSAGE });
  });

  it('sends nothing for an unknown address and does not create a user', async () => {
    expect(await request('stranger@example.test')).toBeUndefined();
    const [{ n }] =
      await db.admin`select count(*)::int as n from users where email = 'stranger@example.test'`;
    expect(n).toBe(0);
    const [audit] = await db.admin`select after from audit_log
      where action = 'auth.otp_suppressed' order by created_at desc limit 1`;
    expect(audit.after.reason).toBe('no_membership');
    expect(audit.after.email_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(audit.after)).not.toContain('stranger@example.test');
    expect(audit.after.email_hash).toBe(
      createHash('sha256').update('stranger@example.test').digest('hex')
    );
  });

  it('sends nothing to staff', async () => {
    expect(await request('admin@example.test')).toBeUndefined();
    const [audit] = await db.admin`select after from audit_log
      where action = 'auth.otp_suppressed' and actor_user_id = ${IDS.admin}
      order by created_at desc limit 1`;
    expect(audit.after.reason).toBe('staff');
  });

  it('accepts a pending invitation and asks for a profile when the name is empty', async () => {
    const code = await request('invitee-a@example.test');
    expect(code).toBeTruthy();
    const verified = await verifyEmailOtp(deps(), 'invitee-a@example.test', code!);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.next).toBe('/sign-up/profile');
    const [member] = await db.admin`select m.role, i.accepted_at
      from users u
      join memberships m on m.user_id = u.id
      join invitations i on i.email = u.email
      where u.email = 'invitee-a@example.test'`;
    expect(member.role).toBe('staff');
    expect(member.accepted_at).not.toBeNull();
    const [{ n }] =
      await db.admin`select count(*)::int as n from users where email = 'invitee-a@example.test'`;
    expect(n).toBe(1);
  });

  it('refuses an expired code and an expired invitation', async () => {
    const code = await request('staff-a@example.test');
    await db.admin`update verifications set expires_at = now() - interval '1 minute' where identifier like 'email-otp:%'`;
    expect(await verifyEmailOtp(deps(), 'staff-a@example.test', code!)).toEqual({
      ok: false,
      message: EMAIL_CODE_FAILED_MESSAGE
    });
    await db.admin`update invitations set expires_at = now() - interval '1 minute' where email = 'invitee-b@example.test'`;
    expect(await request('invitee-b@example.test')).toBeUndefined();
  });

  it('locks the code after five wrong attempts', async () => {
    const code = await request('owner-b@example.test');
    for (let i = 0; i < 5; i++) {
      expect(await verifyEmailOtp(deps(), 'owner-b@example.test', '000000')).toEqual({
        ok: false,
        message: EMAIL_CODE_FAILED_MESSAGE
      });
    }
    expect(await verifyEmailOtp(deps(), 'owner-b@example.test', code!)).toEqual({
      ok: false,
      message: EMAIL_CODE_FAILED_MESSAGE
    });
    const reasons = await db.admin`select after->>'reason' as reason from audit_log
      where action = 'auth.otp_failed' and actor_user_id = ${IDS.ownerB}`;
    expect(reasons.map((row) => row.reason)).toContain('locked');
  });

  it('the owner can emergency-reset a staff authenticator; the app and auth roles cannot', async () => {
    await db.owner`select emergency_reset_staff_two_factor(${'va@example.test'})`;
    const [user] = await db.admin`select two_factor_enabled from users where id = ${IDS.va}`;
    expect(user.two_factor_enabled).toBe(false);
    const [audit] = await db.admin`select action, after from audit_log
      where action = 'user.2fa_emergency_reset' and entity_id = ${IDS.va}`;
    expect(audit.after.via).toBe('emergency_cli');
    await expect(
      db.owner`select emergency_reset_staff_two_factor(${'owner-a@example.test'})`
    ).rejects.toThrow(/staff user not found/);
    await expect(
      db.auth`select emergency_reset_staff_two_factor(${'va@example.test'})`
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.app`select emergency_reset_staff_two_factor(${'va@example.test'})`
    ).rejects.toThrow(/permission denied/);
    await expect(db.app`select accept_pending_invitations(${IDS.ownerA}::uuid)`).rejects.toThrow(
      /permission denied/
    );
  });
});
