import "server-only";
import { auditLog } from "./db/schema";
import type { Tx } from "./db/scoped";

export async function audit(tx: Tx, entry: { actorUserId?: string | null; clientId?: string | null; action: string; meta?: Record<string, unknown> }) {
  await tx.insert(auditLog).values({ actorUserId: entry.actorUserId ?? null, clientId: entry.clientId ?? null, action: entry.action, meta: entry.meta ?? null });
}
