import "server-only";
import { env } from "./env";
import { hmac, safeEqual } from "./crypto";

const TTL_SEC = 10 * 60;

/** Short-lived download URL bound to the viewer's user id. The route ALSO checks session + tenant. */
export function signedFileUrl(docId: string, userId: string, download = true): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const sig = hmac(env.fileSigningSecret, `${docId}.${userId}.${exp}`);
  return `/api/files/${docId}?exp=${exp}&sig=${sig}${download ? "" : "&inline=1"}`;
}

export function verifyFileSig(docId: string, userId: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEqual(hmac(env.fileSigningSecret, `${docId}.${userId}.${exp}`), sig);
}

export const ALLOWED_MIME = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip",
  "audio/mpeg", "audio/wav", "video/mp4",
]);
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
