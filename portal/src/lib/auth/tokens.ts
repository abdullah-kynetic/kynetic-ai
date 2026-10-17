import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authTokens, users } from "../db/schema";
import { withScope } from "../db/scoped";
import { randomToken, sha256 } from "../crypto";

type TokenType = "magic" | "reset" | "invite";
const TTL_MIN: Record<TokenType, number> = { magic: 15, reset: 30, invite: 60 * 24 * 7 };

/** Creates a single-use token; only its sha256 is stored. Returns the raw token for the email link. */
export async function issueToken(userId: string, type: TokenType): Promise<string> {
  const raw = randomToken(32);
  await withScope({ role: "system" }, async (tx) => {
    // Invalidate older outstanding tokens of the same type.
    await tx.update(authTokens).set({ usedAt: new Date() })
      .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type), isNull(authTokens.usedAt)));
    await tx.insert(authTokens).values({ userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + TTL_MIN[type] * 60_000) });
  });
  return raw;
}

/** Looks up a live token without consuming it. */
export async function peekToken(raw: string, type: TokenType) {
  if (!raw || raw.length > 100) return null;
  return withScope({ role: "system" }, async (tx) => {
    const [row] = await tx.select({ tokenId: authTokens.id, user: users }).from(authTokens)
      .innerJoin(users, eq(users.id, authTokens.userId))
      .where(and(eq(authTokens.tokenHash, sha256(raw)), eq(authTokens.type, type), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
      .limit(1);
    return row ?? null;
  });
}

/** Atomically consumes a token. Returns the user id or null if already used/expired. */
export async function consumeToken(raw: string, type: TokenType): Promise<string | null> {
  if (!raw || raw.length > 100) return null;
  return withScope({ role: "system" }, async (tx) => {
    const [row] = await tx.update(authTokens).set({ usedAt: new Date() })
      .where(and(eq(authTokens.tokenHash, sha256(raw)), eq(authTokens.type, type), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
      .returning({ userId: authTokens.userId });
    return row?.userId ?? null;
  });
}
