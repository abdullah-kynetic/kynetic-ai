import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { recoveryCodes } from "../db/schema";
import { withScope } from "../db/scoped";
import { sha256 } from "../crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i look-alikes
export const RECOVERY_CODE_COUNT = 10;

const normalise = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, "");
export const looksLikeRecoveryCode = (c: string) => normalise(c).length === 10 && !/^\d{6}$/.test(c.replace(/\s+/g, ""));

function newCode(): string {
  const chars = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

/** Replaces all of the user's recovery codes with a fresh set. Returns the raw codes — the only time they exist. */
export async function generateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newCode);
  await withScope({ role: "system" }, async (tx) => {
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await tx.insert(recoveryCodes).values(codes.map((c) => ({ userId, codeHash: sha256(normalise(c)) })));
  });
  return codes;
}

/** Atomically burns a recovery code. True only if it matched an unused code for this user. */
export async function consumeRecoveryCode(userId: string, input: string): Promise<boolean> {
  const hash = sha256(normalise(input));
  return withScope({ role: "system" }, async (tx) => {
    const rows = await tx.update(recoveryCodes).set({ usedAt: new Date() })
      .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.codeHash, hash), isNull(recoveryCodes.usedAt)))
      .returning({ id: recoveryCodes.id });
    return rows.length === 1;
  });
}

export async function remainingRecoveryCodes(userId: string): Promise<number> {
  return withScope({ role: "system" }, async (tx) => {
    const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(recoveryCodes)
      .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
    return r?.n ?? 0;
  });
}
