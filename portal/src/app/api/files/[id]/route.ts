import { getSession, type AdminSession, type ClientSession } from "@/lib/auth/session";
import { findClientDocument } from "@/lib/data/client";
import { adminFindDocument } from "@/lib/data/admin";
import { isUuid, verifyFileSig } from "@/lib/files";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * File download. Three independent checks, all required:
 *   1. a live session (role/client re-read from DB),
 *   2. an unexpired HMAC signature bound to THIS user + document,
 *   3. a tenant-scoped lookup (client: id AND client_id = session.clientId, plus RLS).
 * Every failure is a 404 so ids can't be probed.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const s = await getSession();
  if (!s) return new Response("Unauthorized", { status: 401 });
  if (!isUuid(id)) return notFound();
  const url = new URL(req.url);
  if (!verifyFileSig(id, s.userId, url.searchParams.get("exp"), url.searchParams.get("sig"))) return notFound();
  if (s.role === "admin" && s.needsMfaSetup) return notFound();
  const doc = s.role === "admin" ? await adminFindDocument(s as AdminSession, id) : await findClientDocument(s as ClientSession, id);
  if (!doc) return notFound();
  const body = await storage().get(doc.storageKey);
  if (!body) return notFound();
  const inline = url.searchParams.get("inline") === "1" && /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(doc.mime);
  const filename = doc.name.replace(/[^\w.\- ()]/g, "_");
  return new Response(body, {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(doc.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
