import { sql } from 'drizzle-orm';
import { withPlatform, type PlatformContext } from '../tenancy';
import type { Db } from '../db/client';
import { and, eq } from 'drizzle-orm';
import { audit } from '../audit';
import { calls } from '../db/schema';
import { withTenant } from '../tenancy';
import { enqueue } from '../jobs';
import { AppError } from '../errors';

export type IntegrationHealthRow = {
  tenantId: string; tenantName: string; kind: string; status: string; a2pStatus: string;
  lastSuccessAt: string | null; lastErrorAt: string | null; lastError: string | null; errorCount: number;
};

export type FlaggedCallRow = {
  callId: string; tenantId: string; tenantName: string; contactId: string | null;
  startedAt: string; flagNote: string | null; flaggedAt: string | null; flaggedBy: string | null;
};

export type FailedWebhookRow = {
  eventId: string; tenantId: string | null; tenantName: string; source: string;
  externalId: string; attempts: number; lastError: string; receivedAt: string;
};

export type AdminJobRow = {
  id: string; name: string; state: string; createdAt: string;
  startedAt: string | null; completedAt: string | null; retryCount: number;
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

export async function listFailedWebhooks(ctx: PlatformContext, opts: { db?: Db } = {}): Promise<FailedWebhookRow[]> {
  const rows = await withPlatform(ctx, (tx) => tx.execute(sql`select * from admin_list_failed_webhooks()`), opts);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    eventId: String(r.event_id), tenantId: (r.tenant_id as string | null) ?? null,
    tenantName: String(r.tenant_name), source: String(r.source), externalId: String(r.external_id),
    attempts: Number(r.attempts), lastError: String(r.last_error), receivedAt: String(r.received_at)
  }));
}

/** Read-only summary from pg-boss's common queue table. Job payloads and outputs are never returned. */
export async function listRecentJobs(ctx: { userId: string; role: 'admin' }, opts: { db?: Db } = {}): Promise<AdminJobRow[]> {
  const rows = await withPlatform(ctx, (tx) => tx.execute(sql`select id, name, state, created_on, started_on, completed_on, retry_count from pgboss.job_common order by created_on desc limit 100`), opts);
  return (rows as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), name: String(row.name), state: String(row.state),
    createdAt: String(row.created_on), startedAt: (row.started_on as string | null) ?? null,
    completedAt: (row.completed_on as string | null) ?? null, retryCount: Number(row.retry_count)
  }));
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

export async function replayFailedWebhook(ctx: { userId: string; role: 'admin' }, webhookId: string, opts: { db?: Db } = {}) {
  return withPlatform(ctx, async (tx) => {
    const rows = await tx.execute(sql`select admin_replay_webhook(${webhookId}::uuid) as replayed`);
    if (!(rows as unknown as { replayed: boolean }[])[0]?.replayed) throw new AppError('NOT_FOUND');
    await enqueue('webhook.process', { webhookEventId: webhookId }, { tx });
    return { replayed: true };
  }, opts);
}
