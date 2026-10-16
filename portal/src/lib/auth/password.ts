import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id (algorithm 2), OWASP-recommended baseline parameters.
const opts = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => hash(pw, opts);

export async function verifyPassword(hashStr: string | null, pw: string): Promise<boolean> {
  if (!hashStr) {
    // Burn comparable time so unknown users are not distinguishable by timing.
    await hash(pw, opts);
    return false;
  }
  try { return await verify(hashStr, pw); } catch { return false; }
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return "Use at least 12 characters.";
  if (pw.length > 256) return "Password is too long.";
  return null;
}
