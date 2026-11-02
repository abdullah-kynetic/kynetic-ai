import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { AppError } from '../errors';
import { withPlatform } from '../tenancy';

export async function setOutboundKillSwitch(
  ctx: { userId: string; role: 'admin' },
  tenantId: string | null,
  enabled: boolean,
  opts: { db?: Db } = {}
) {
  if (tenantId)
    return withPlatform(
      ctx,
      (tx) => tx.execute(sql`select admin_set_outbound_kill_switch(${tenantId}::uuid, ${enabled})`),
      opts
    );
  return withPlatform(
    ctx,
    async (tx) => {
      const tenants = (await tx.execute(
        sql`select tenant_id from admin_tenant_overview()`
      )) as unknown as { tenant_id: string }[];
      for (const tenant of tenants)
        await tx.execute(
          sql`select admin_set_outbound_kill_switch(${tenant.tenant_id}::uuid, ${enabled})`
        );
      return { changed: tenants.length };
    },
    opts
  );
}

export async function replayWebhook(
  ctx: { userId: string; role: 'admin' },
  webhookId: string,
  opts: { db?: Db } = {}
) {
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select admin_replay_webhook(${webhookId}::uuid) as replayed`),
    opts
  );
  if (!(rows as unknown as { replayed: boolean }[])[0]?.replayed) throw new AppError('NOT_FOUND');
  return { replayed: true };
}

export async function suspendTenant(
  ctx: { userId: string; role: 'admin' },
  tenantId: string,
  suspended: boolean,
  opts: { db?: Db } = {}
) {
  return withPlatform(
    ctx,
    (tx) =>
      tx.execute(
        sql`select admin_update_tenant_commercial(${tenantId}::uuid, ${JSON.stringify({ status: suspended ? 'suspended' : 'active' })}::jsonb)`
      ),
    opts
  );
}
