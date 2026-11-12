import "server-only";
import { createHmac } from "node:crypto";
import { env } from "../env";
import { safeEqual } from "../crypto";

/** "Remember this device": a signed cookie that skips the email code (never the password). */
export const DEVICE_COOKIE = "kp_td";
export const DEVICE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

type Subject = { id: string; sessionVersion: number };

// Bound to the session version so a password change/reset revokes every trusted device.
const sign = (u: Subject, exp: number) => createHmac("sha256", env.encryptionKey)
  .update(`trusted-device.v2.${u.id}.${exp}.${u.sessionVersion}`).digest("base64url");

export function issueDeviceToken(u: Subject, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + DEVICE_MAX_AGE_SEC;
  return `${u.id}.${exp}.${sign(u, exp)}`;
}

function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function isTrustedDevice(u: Subject, headers: Headers, now = Date.now()): boolean {
  const raw = readCookie(headers.get("cookie"), DEVICE_COOKIE);
  const [uid, expStr, sig, ...rest] = raw?.split(".") ?? [];
  if (!uid || !expStr || !sig || rest.length || uid !== u.id) return false;
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || exp * 1000 < now) return false;
  return safeEqual(sig, sign(u, exp));
}
