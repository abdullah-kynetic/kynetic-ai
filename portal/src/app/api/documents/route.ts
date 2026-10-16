import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { withScope } from "@/lib/db/scoped";
import { clients, documents } from "@/lib/db/schema";
import { ALLOWED_MIME, isUuid } from "@/lib/files";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { hit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Upload (multipart: file, category?, clientId? [admin only]).
 * Clients ALWAYS upload into their own tenant: any clientId they send is ignored.
 */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role === "admin" && s.needsMfaSetup) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await hit(`upload:user:${s.userId}`, 30, 10 * 60))) return Response.json({ error: "Too many uploads, slow down." }, { status: 429 });

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > env.maxUploadBytes + 64 * 1024) return Response.json({ error: "File too large." }, { status: 413 });
  let fd: FormData;
  try { fd = await req.formData(); } catch { return Response.json({ error: "Invalid upload." }, { status: 400 }); }
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > env.maxUploadBytes) return Response.json({ error: "File too large." }, { status: 413 });
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) return Response.json({ error: "That file type isn't allowed." }, { status: 415 });
  const name = (file.name || "upload").replace(/[\u0000-\u001f\\/]/g, "_").slice(0, 200);
  const category = String(fd.get("category") ?? "General").trim().slice(0, 60) || "General";

  let clientId: string;
  if (s.role === "admin") {
    const requested = String(fd.get("clientId") ?? "");
    if (!isUuid(requested)) return Response.json({ error: "Invalid client." }, { status: 400 });
    clientId = requested;
  } else {
    clientId = s.clientId!; // never from the request
  }
  const scope = s.role === "admin" ? { role: "admin" as const, userId: s.userId } : { role: "client" as const, userId: s.userId, clientId };

  // Confirm the tenant exists/is visible in this scope before writing bytes.
  const ok = await withScope(scope, async (tx) => (await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId))).length === 1);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });

  const storageKey = `${clientId}/${randomUUID()}`;
  await storage().put(storageKey, Buffer.from(await file.arrayBuffer()), mime);
  try {
    const [doc] = await withScope(scope, async (tx) => {
      const rows = await tx.insert(documents).values({ clientId, name, category, storageKey, mime, size: file.size, uploadedBy: s.userId, uploadedByRole: s.role }).returning({ id: documents.id });
      await audit(tx, { actorUserId: s.userId, clientId, action: "document.uploaded", meta: { name, size: file.size } });
      return rows;
    });
    revalidatePath(s.role === "admin" ? `/admin/clients/${clientId}` : "/documents", "layout");
    return Response.json({ ok: true, id: doc.id });
  } catch (e) {
    await storage().remove(storageKey).catch(() => {});
    throw e;
  }
}
