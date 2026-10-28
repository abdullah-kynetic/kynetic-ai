import { sql } from 'drizzle-orm';
import { withPlatform, type PlatformContext } from '../tenancy';
import type { Db } from '../db/client';
import { and, eq } from 'drizzle-orm';
import { audit } from '../audit';
import { calls } from '../db/schema';
import { withTenant } from '../tenancy';

export type IntegrationHealthRow = {
  tenantId: string; tenantName: string; kind: string; status: string; a2pStatus: string;
  lastSuccessAt: string | null; lastErrorAt: string | null; lastError: string | null; errorCount: number;
};

export type FlaggedCallRow = {
  callId: string; tenantId: string; tenantName: string; contactId: string | null;
  startedAt: string; flagNote: string | null; flaggedAt: string | null; flaggedBy: string | null;
};

export async function listIntegrationHealth(ctx: PlatformContext, opts: { db?: Db } = {}) {
  const rows = await withPlatform(ctx, (tx) => tx.execute(sql`select * from admin_integration_health()`), opts);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    tenantId: String(r.tenant_id), tenantName: String(r.tenant_name), kind: String(r.kind),
    status: String(r.status), a2pStatus: String(r.a2p_status),
    lastSuccessAt: (r.last_success_at as string | null) ?? null,
    lastErrorAt: (r.last_error_at as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null, errorCount: Number(r.error_count)
  })) as IntegrationHealthRow[];
}

export async function listFlaggedCalls(ctx: PlatformContext, opts: { db?: Db } = {}) {
  const rows = await withPlatform(ctx, (tx) => tx.execute(sql`select * from admin_flagged_calls()`), opts);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    callId: String(r.call_id), tenantId: String(r.tenant_id), tenantName: String(r.tenant_name),
    contactId: (r.contact_id as string | null) ?? null, startedAt: String(r.started_at),
    flagNote: (r.flag_note as string | null) ?? null, flaggedAt: (r.flagged_at as string | null) ?? null,
    flaggedBy: (r.flagged_by as string | null) ?? null
  })) as FlaggedCallRow[];
}

export async function markFlaggedCallReviewed(
  actor: PlatformContext,
  input: { tenantId: string; callId: string },
  opts: { db?: Db } = {}
): Promise<boolean> {
  const rows = await withTenant(
    { tenantId: input.tenantId, userId: actor.userId, role: actor.role },
    async (tx) => {
      const changed = await tx.update(calls).set({ flaggedBy: actor.userId, updatedAt: new Date().toISOString() })
        .where(and(eq(calls.id, input.callId), eq(calls.flagged, true))).returning({ id: calls.id });
      if (changed.length) await audit(tx, { action: 'call.flag_reviewed', entity: 'call', entityId: input.callId });
      return changed;
    }, opts
  );
  return rows.length > 0;
}
