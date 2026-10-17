import "server-only";
import { generateSecret, generateURI, verify } from "otplib";

export const newTotpSecret = () => generateSecret();
export const totpUri = (email: string, secret: string) => generateURI({ issuer: "Kynetic Portal", label: email, secret });

/** Returns the matched time step (for replay protection) or null. */
export async function checkTotp(secret: string, token: string, lastStep: number | null): Promise<number | null> {
  const clean = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const res = await verify({ secret, token: clean, epochTolerance: 30 });
  if (!res.valid) return null;
  const epoch = (res as { epoch?: number }).epoch ?? Date.now() / 1000;
  const step = Math.floor(epoch / 30);
  if (lastStep !== null && step <= lastStep) return null; // replayed code
  return step;
}
