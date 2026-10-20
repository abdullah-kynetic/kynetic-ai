import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { isPwned } from "./pwned";

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

/** Full new-password check: length rules (sync) plus the breached-password screen. Returns an error message or null. */
export async function newPasswordProblem(pw: string): Promise<string | null> {
  const basic = passwordProblem(pw);
  if (basic) return basic;
  if (await isPwned(pw)) return "That password has appeared in a known data breach. Please choose a different one.";
  return null;
}
