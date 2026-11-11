import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { StaffCaller } from '../admin/users';
import type { Db } from '../db/client';
import { parseInput } from '../validation';
import { AppError } from '../errors';
import { inAgency } from './index';
import { agencyRates, dailyRateSeries } from './rates';
export const inboxFilter = z.strictObject({
  channel: z.enum(['sms', 'email', 'dm']).optional(),
  status: z
    .enum(['queued', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'received', 'logged'])
    .optional(),
  contactId: z.uuid().optional()
});
export type InboxRow = {
  id: string;
  contact_id: string;
  channel: string;
  direction: string;
  status: string;
  body: string;
  subject: string | null;
  at: string;
  name: string;
};
const combined = sql`select id,tenant_id,contact_id,channel,direction,status,body,subject,created_at as at from messages where provider is distinct from 'agency_stub'
 union all select id,tenant_id,contact_id,'dm',direction,'logged',body,platform,occurred_at from agency_dm_logs`;
export async function listAgencyInbox(
  caller: StaffCaller,
  raw: unknown = {},
  opts: { db?: Db } = {}
) {
  const f = parseInput(inboxFilter, raw);
  return inAgency(
    caller,
    async (tx) =>
      Array.from(
        await tx.execute<InboxRow>(sql`
 select m.id,m.contact_id,m.channel,m.direction,m.status,m.body,m.subject,m.at,c.first_name as name
 from (${combined}) m join contacts c on c.id=m.contact_id and c.tenant_id=m.tenant_id
 where c.deleted_at is null and c.merged_into_id is null
 ${f.channel ? sql`and m.channel=${f.channel}` : sql``} ${f.status ? sql`and m.status=${f.status}` : sql``} ${f.contactId ? sql`and m.contact_id=${f.contactId}` : sql``}
 order by m.at desc,m.id desc limit 100`)
      ),
    opts
  );
}
export async function logAgencyDm(caller: StaffCaller, raw: unknown, opts: { db?: Db } = {}) {
  const i = parseInput(
    z.strictObject({
      contactId: z.uuid(),
      direction: z.enum(['inbound', 'outbound']),
      platform: z.string().trim().min(1).max(80),
      body: z.string().trim().min(1).max(5000)
    }),
    raw
  );
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const found = await tx.execute(
        sql`select id from contacts where id=${i.contactId} and deleted_at is null and merged_into_id is null`
      );
      if (!found.length) throw new AppError('NOT_FOUND');
      await tx.execute(
        sql`insert into agency_dm_logs(tenant_id,contact_id,direction,platform,body,logged_by) values(${tenantId},${i.contactId},${i.direction},${i.platform},${i.body},${caller.id})`
      );
    },
    opts
  );
}
export async function getAgencyRates(
  caller: StaffCaller,
  opts: { db?: Db; now?: Date; days?: number } = {}
) {
  const now = opts.now ?? new Date(),
    days = opts.days ?? 7,
    since = new Date(now.getTime() - days * 86400000).toISOString(),
    until = now.toISOString();
  return inAgency(
    caller,
    async (tx) => {
      const attempts = await tx.execute<{ outcome: string }>(sql`
   select outcome from agency_call_attempts where logged_at>=${since} and logged_at<=${until}
   union all select outcome from calls where direction='outbound' and provider not in ('fake','stub') and started_at>=${since} and started_at<=${until}`);
      const rows = await tx.execute<{ contactId: string; direction: string; at: string }>(sql`
   select m.contact_id as "contactId",m.direction,m.at from (${combined}) m join contacts c on c.id=m.contact_id and c.tenant_id=m.tenant_id
   where c.deleted_at is null and c.merged_into_id is null and m.at>=${since} and m.at<=${until} and m.status in ('sent','delivered','received','logged')`);
      return {
        ...agencyRates(
          Array.from(attempts, (a) => a.outcome),
          Array.from(rows)
        ),
        since,
        until
      };
    },
    opts
  );
}

/** Daily pick and reply rates across the last `days` days for the 30-day trend line. */
export async function getAgencyRateSeries(
  caller: StaffCaller,
  opts: { db?: Db; now?: Date; days?: number } = {}
) {
  const now = opts.now ?? new Date(),
    days = opts.days ?? 30,
    since = new Date(now.getTime() - days * 86400000).toISOString(),
    until = now.toISOString();
  return inAgency(
    caller,
    async (tx) => {
      const attempts = await tx.execute<{ outcome: string; at: string }>(sql`
   select outcome,logged_at as at from agency_call_attempts where logged_at>=${since} and logged_at<=${until}
   union all select outcome,started_at as at from calls where direction='outbound' and provider not in ('fake','stub') and started_at>=${since} and started_at<=${until}`);
      const rows = await tx.execute<{ contactId: string; direction: string; at: string }>(sql`
   select m.contact_id as "contactId",m.direction,m.at from (${combined}) m join contacts c on c.id=m.contact_id and c.tenant_id=m.tenant_id
   where c.deleted_at is null and c.merged_into_id is null and m.at>=${since} and m.at<=${until} and m.status in ('sent','delivered','received','logged')`);
      return {
        points: dailyRateSeries(
          Array.from(attempts, (a) => ({ outcome: a.outcome, at: a.at })),
          Array.from(rows),
          days,
          now
        ),
        since,
        until
      };
    },
    opts
  );
}
