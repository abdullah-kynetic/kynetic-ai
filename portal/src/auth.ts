import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { authenticatePassword, authenticateMagic, findByEmail, recordGoogleLogin } from "@/lib/auth/authenticate";
import { decideGoogleLogin, googleEnabled, type GoogleProfile } from "@/lib/auth/google";

class PortalAuthError extends CredentialsSignin {
  constructor(code: string) { super(); this.code = code; }
}

const passwordInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
  totp: z.string().max(40).optional().default(""),
});
const magicInput = z.object({ token: z.string().min(10).max(100), totp: z.string().max(40).optional().default("") });

const SESSION_MAX_AGE = 60 * 60 * 24 * 3; // 3 days (admins are capped at 12h in getSession)

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    // Only registered when both env vars are set. Access is still gated on an existing invited account (see signIn below).
    ...(googleEnabled() ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })] : []),
    Credentials({
      id: "password",
      credentials: { email: {}, password: {}, totp: {} },
      async authorize(raw, request) {
        const parsed = passwordInput.safeParse(raw);
        if (!parsed.success) throw new PortalAuthError("invalid");
        const r = await authenticatePassword(parsed.data, request.headers);
        if (!r.ok) throw new PortalAuthError(r.code);
        return { id: r.userId, sv: r.sessionVersion } as never;
      },
    }),
    Credentials({
      id: "magic",
      credentials: { token: {}, totp: {} },
      async authorize(raw, request) {
        const parsed = magicInput.safeParse(raw);
        if (!parsed.success) throw new PortalAuthError("invalid_link");
        const r = await authenticateMagic(parsed.data, request.headers);
        if (!r.ok) throw new PortalAuthError(r.code);
        return { id: r.userId, sv: r.sessionVersion } as never;
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const d = await decideGoogleLogin(profile as GoogleProfile, async (email) => (await findByEmail(email)) ?? null);
      return d.ok; // false → /login?error=AccessDenied; no account is ever created
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
        const d = await decideGoogleLogin(profile as GoogleProfile, async (email) => (await findByEmail(email)) ?? null);
        if (!d.ok) throw new Error("google login not permitted");
        token.uid = d.userId;
        token.sv = d.sessionVersion;
        await recordGoogleLogin(d.userId);
        return token;
      }
      if (user) {
        token.uid = (user as { id: string }).id;
        token.sv = (user as unknown as { sv: number }).sv;
      }
      return token;
    },
    session({ session, token }) {
      // Only identifiers travel in the session; role/client are re-read from the DB on every request.
      return { ...session, uid: token.uid as string, sv: token.sv as number, iat: token.iat as number };
    },
  },
});
