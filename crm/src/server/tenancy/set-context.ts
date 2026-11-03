import { sql } from 'drizzle-orm';
import type { Tx } from '../db/client';

type Settings = {
  tenantId?: string;
  userId?: string;
  role: string;
  impersonatorId?: string;
  readOnly: boolean;
};

/**
 * The only place that sets `app.*` session variables. Transaction-local (`is_local = true`), so a
 * pooled connection never carries them into the next unit of work (SEC-T-04). No raw set_config
 * anywhere else (DATABASE.md "Storage model").
 */
export async function setSessionContext(tx: Tx, s: Settings): Promise<void> {
  await tx.execute(sql`select
    set_config('app.tenant_id', ${s.tenantId ?? ''}, true),
    set_config('app.user_id', ${s.userId ?? ''}, true),
    set_config('app.role', ${s.role}, true),
    set_config('app.impersonator_id', ${s.impersonatorId ?? ''}, true),
    set_config('app.read_only', ${s.readOnly ? 'on' : 'off'}, true)`);
}
