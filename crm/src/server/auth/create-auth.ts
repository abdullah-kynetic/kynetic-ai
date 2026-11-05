import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { magicLink, twoFactor } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import { authUsers } from './auth-schema';
import { evaluateGate, isStaffEmail } from './gate';
import { SESSION_EXPIRES_IN_SECONDS, SESSION_UPDATE_AGE_SECONDS } from './lifetimes';
import { recoveryCodeStorage, twoFactorHooks } from './two-factor';

export const MAGIC_LINK_TTL_SECONDS = 15 * 60;

export type AuthDeps = {
  /** Connection as kynetic_auth. */
  db: Db;
  baseUrl: string;
  secret: string;
  google?: { clientId: string; clientSecret: string };
  /** Delivers the sign-in link. Wired to the email adapter; tests capture it. */
  sendMagicLink: (msg: { email: string; url: string }) => Promise<void>;
};

const denied = () => new APIError('FORBIDDEN', { message: 'This account cannot sign in.' });

export function createAuth(deps: AuthDeps) {
  const secure = deps.baseUrl.startsWith('https://');
  return betterAuth({
    appName: 'Kynetic',
    baseURL: deps.baseUrl,
    secret: deps.secret,
    logger: { disabled: true },
    database: drizzleAdapter(deps.db, {
      provider: 'pg',
      schema: {
        user: authUsers,
        session: schema.sessions,
        twoFactor: schema.twoFactors,
        account: schema.accounts,
        verification: schema.verifications
      }
    }),
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: false,
      // `__Host-` needs Secure, so it applies wherever we serve over https.
      cookies: secure ? { session_token: { name: '__Host-kynetic.session_token' } } : undefined,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure, path: '/' }
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS
    },
    rateLimit: {
      enabled: true,
      // The route wrapper enforces the shared PostgreSQL-backed 5/min IP and 10/hour email rules.
      // Disable Better Auth's stricter in-memory magic-link default so limits are consistent across
      // app instances and match SECURITY 5.4.
      customRules: { '/sign-in/magic-link': false }
    },
    account: {
      // Google links to an existing user only when Google reports the email verified. No
      // trustedProviders, so an unverified email never links.
      accountLinking: { enabled: true },
      encryptOAuthTokens: true
    },
    socialProviders: deps.google
      ? {
          google: {
            clientId: deps.google.clientId,
            clientSecret: deps.google.clientSecret,
            // Do not create users from Google on the fly; the hook below refuses the uninvited.
            prompt: 'select_account'
          }
        }
      : {},
    hooks: twoFactorHooks(deps.db, deps.secret),
    plugins: [
      twoFactor({
        issuer: 'Kynetic',
        // Staff sign in with Google and have no password to confirm with.
        allowPasswordless: true,
        backupCodeOptions: { storeBackupCodes: recoveryCodeStorage(deps.secret) }
      }),
      magicLink({
        expiresIn: MAGIC_LINK_TTL_SECONDS,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url }) => {
          // Silent no-op for anyone who may not sign in or who is staff, so the response never says
          // whether an address is known (SECURITY 5.4: generic message, no enumeration).
          const gate = await evaluateGate(deps.db, email);
          if (!gate.allowed || (await isStaffEmail(deps.db, email))) return;
          await deps.sendMagicLink({ email, url });
        }
      })
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const gate = await evaluateGate(deps.db, user.email);
            if (!gate.allowed) throw denied();
          }
        }
      },
      session: {
        create: {
          before: async (session) => {
            const [u] = await deps.db
              .select({ email: schema.users.email })
              .from(schema.users)
              .where(eq(schema.users.id, session.userId))
              .limit(1);
            if (!u || !(await evaluateGate(deps.db, u.email)).allowed) throw denied();
          },
          after: async (session) => {
            await deps.db
              .update(schema.users)
              .set({ lastLoginAt: new Date() })
              .where(eq(schema.users.id, session.userId));
          }
        }
      }
    }
  });
}

export type Auth = ReturnType<typeof createAuth>;
