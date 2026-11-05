import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getAuthDb, type Db } from '../db/client';
import * as schema from '../db/schema';
import { getAuth } from './index';
import { authUsers } from './auth-schema';
import {
  sessionExpired,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS
} from './lifetimes';
import type { AuthUser } from './index';
import type { Auth } from './create-auth';

/** Existing session verification only. No sign-in, registration or provider route is exposed here. */
export function createSessionAuth(opts: {
  db: Db;
  baseUrl: string;
  secret: string;
  /** In-memory adapter for unit tests; never selected from request input. */
  adapter?: BetterAuthOptions['database'];
}) {
  return betterAuth({
    baseURL: opts.baseUrl,
    logger: { disabled: true },
    secret: opts.secret,
    database:
      opts.adapter ??
      drizzleAdapter(opts.db, {
        provider: 'pg',
        schema: {
          user: authUsers,
          session: schema.sessions,
          account: schema.accounts,
          verification: schema.verifications
        }
      }),
    advanced: {
      database: { generateId: 'uuid' },
      // The HTTPS name already has __Host-. Avoid the library adding a second __Secure- prefix.
      useSecureCookies: false,
      cookies: opts.baseUrl.startsWith('https://')
        ? { session_token: { name: '__Host-kynetic.session_token' } }
        : undefined,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: opts.baseUrl.startsWith('https://'),
        path: '/'
      }
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      disableSessionRefresh: true,
      cookieCache: { enabled: false }
    }
  });
}

type SessionAuth = ReturnType<typeof createSessionAuth>;
export type SessionDeps = {
  db?: Db;
  auth?: Pick<SessionAuth, 'api'> | Pick<Auth, 'api'>;
  now?: Date;
};

/** A signed cookie must resolve to a live, unexpired DB session and a current enabled user. */
export async function getVerifiedSessionUser(
  headers: Headers,
  deps: SessionDeps = {}
): Promise<AuthUser | null> {
  // Avoid DB connections and auth initialization for anonymous/persona-only requests.
  const hasSession = (headers.get('cookie') ?? '').split(';').some((part) => {
    const name = part.trim().split('=', 1)[0];
    return name === '__Host-kynetic.session_token' || name === 'better-auth.session_token';
  });
  if (!hasSession) return null;
  try {
    const auth = deps.auth ?? getAuth();
    const found = await auth.api.getSession({
      headers,
      query: { disableCookieCache: true, disableRefresh: true }
    });
    if (!found) return null;
    const db = deps.db ?? getAuthDb();
    const now = deps.now ?? new Date();
    const [row] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        kyneticRole: schema.users.kyneticRole,
        disabledAt: schema.users.disabledAt,
        expiresAt: schema.sessions.expiresAt,
        twoFactorEnabled: schema.users.twoFactorEnabled,
        twoFactorVerifiedAt: schema.sessions.twoFactorVerifiedAt,
        createdAt: schema.sessions.createdAt,
        updatedAt: schema.sessions.updatedAt
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .where(
        and(
          eq(schema.sessions.id, found.session.id),
          eq(schema.users.id, found.user.id),
          gt(schema.sessions.expiresAt, now),
          isNull(schema.users.disabledAt)
        )
      )
      .limit(1);
    if (!row || row.disabledAt || row.expiresAt <= now) return null;
    const staff = row.kyneticRole === 'admin' || row.kyneticRole === 'va';
    if (sessionExpired(row, staff, now)) return null;
    const verified =
      row.twoFactorVerifiedAt &&
      row.twoFactorVerifiedAt >= row.createdAt &&
      row.twoFactorVerifiedAt <= now;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      kyneticRole: staff ? (row.kyneticRole as 'admin' | 'va') : null,
      twoFactor: !staff
        ? 'not_required'
        : !row.twoFactorEnabled
          ? 'enrol'
          : verified
            ? 'verified'
            : 'challenge'
    };
  } catch {
    // Never pass a provider/DB error containing session material into Next's logs.
    throw new Error('Session verification unavailable');
  }
}
