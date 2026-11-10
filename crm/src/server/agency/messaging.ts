import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { StaffCaller } from '../admin/users';
import type { Db } from '../db/client';
import { AppError } from '../errors';
import { parseInput } from '../validation';
import { checkOutbound } from '../outbound/gate';
import { checkWindow, DEFAULT_WINDOW, isValidTimeZone } from '../consent/quiet-hours';
import { inAgency } from './index';
import { deliverAgencyPreview } from './messaging-policy';
type Options = { db?: Db; now?: Date };
export type AgencyDraft = {
  id: string;
  contact_id: string;
  channel: 'sms' | 'email';
  subject: string;
  body: string;
  status: string;
  block_reason: string | null;
};
const draft = z.strictObject({
  contactId: z.uuid(),
  channel: z.enum(['sms', 'email']),
  subject: z.string().trim().max(200).default(''),
  body: z.string().trim().min(1).max(5000)
});
export async function saveAgencyMessage(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const i = parseInput(draft, raw);
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const found = await tx.execute(
        sql`select id from contacts where id=${i.contactId} and deleted_at is null and merged_into_id is null`
      );
      if (!found.length) throw new AppError('NOT_FOUND');
      const rows = await tx.execute<{ id: string }>(
        sql`insert into agency_message_drafts(tenant_id,contact_id,channel,subject,body,created_by) values(${tenantId},${i.contactId},${i.channel},${i.subject},${i.body},${caller.id}) returning id`
      );
      return rows[0];
    },
    opts
  );
}
export async function listAgencyDrafts(caller: StaffCaller, opts: Options = {}) {
  return inAgency(
    caller,
    async (tx) =>
      Array.from(
        await tx.execute<AgencyDraft>(
          sql`select id,contact_id,channel,subject,body,status,block_reason from agency_message_drafts order by created_at desc,id desc limit 50`
        )
      ),
    opts
  );
}
/** No network adapter is imported: this endpoint can ONLY exercise the stub path. */
export async function previewAgencyMessage(
  caller: StaffCaller,
  id: string,
  opts: Options & { outboundEnabledForTest?: boolean } = {}
) {
  parseInput(z.uuid(), id);
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const [m] = await tx.execute<AgencyDraft>(
        sql`select id,contact_id,channel,subject,body,status,block_reason from agency_message_drafts where id=${id} for update`
      );
      if (!m) throw new AppError('NOT_FOUND');
      if (m.status === 'simulated') return { status: 'simulated' as const, duplicate: true };
      const now = opts.now ?? new Date();
      const ctx = { tenantId, userId: caller.id, role: 'admin' as const };
      let decision = await checkOutbound(
        ctx,
        {
          contactId: m.contact_id,
          channel: m.channel,
          module: 'alex_core',
          purpose: 'agency_message_preview'
        },
        now,
        {
          tx,
          ...(opts.outboundEnabledForTest !== undefined
            ? { outboundEnabled: opts.outboundEnabledForTest }
            : {})
        }
      );
      // Email previews also respect quiet hours. Never use the inbound-reply consent bypass.
      if (decision.allowed && m.channel === 'email') {
        const [c] = await tx.execute<{ timezone: string | null }>(
          sql`select coalesce(c.timezone,t.timezone) as timezone from contacts c join tenants t on t.id=c.tenant_id where c.id=${m.contact_id} and c.deleted_at is null`
        );
        if (!c || !isValidTimeZone(c.timezone))
          decision = { allowed: false, reason: 'unknown_timezone' };
        else {
          const window = checkWindow(now, c.timezone!, DEFAULT_WINDOW);
          if (!window.open)
            decision = { allowed: false, reason: 'quiet_hours', retryAt: window.nextOpen };
        }
      }
      const result = await deliverAgencyPreview(decision, async () => {
        await tx.execute(
          sql`insert into messages(tenant_id,contact_id,channel,direction,actor_type,actor_id,from_address,to_address,subject,body,provider,provider_message_id,status) values(${tenantId},${m.contact_id},${m.channel},'outbound','user',${caller.id},'agency-stub','agency-stub',${m.subject},${m.body},'agency_stub',${m.id},'sent')`
        );
        return { providerRequests: 0 };
      });
      await tx.execute(
        sql`update agency_message_drafts set status=${result.status},block_reason=${result.status === 'blocked' ? result.reason : null} where id=${id}`
      );
      return result;
    },
    opts
  );
}
