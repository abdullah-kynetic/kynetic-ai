import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';

const auditInputSchema = z.object({
  /** Dotted verb, e.g. 'module.toggle', 'contact.update', 'auth.login'. */
  action: z.string().trim().min(1),
  entity: z.string().trim().min(1),
  entityId: z.string().trim().min(1).optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  ip: z.union([z.ipv4(), z.ipv6()]).optional(),
  userAgent: z.string().optional()
});

export type AuditInput = z.input<typeof auditInputSchema>;

const nullable = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));

/**
 * Appends one `audit_log` row inside the caller's transaction (F-60), so the audit row commits or
 * rolls back with the write it describes. Tenant, actor and impersonator come from the `app.*`
 * session context set by withTenant, never from the caller, so a service cannot forge them. Sign-in
 * and platform events run without a tenant and are written with a NULL tenant (DC-053). The app
 * role can only INSERT; there is no update or delete path (SEC-T-35).
 */
export async function audit(tx: Tx, input: AuditInput): Promise<void> {
  const e = auditInputSchema.parse(input);
  await tx.execute(sql`
    insert into audit_log
      (tenant_id, actor_user_id, impersonator_user_id, action, entity, entity_id, before, after, ip, user_agent)
    values (
      app_tenant_id(),
      app_user_id(),
      nullif(current_setting('app.impersonator_id', true), '')::uuid,
      ${e.action},
      ${e.entity},
      ${e.entityId ?? null},
      ${nullable(e.before)}::jsonb,
      ${nullable(e.after)}::jsonb,
      ${e.ip ?? null}::inet,
      ${e.userAgent ?? null}
    )`);
}
