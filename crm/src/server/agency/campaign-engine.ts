import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { StaffCaller } from '../admin/users';
import { audit } from '../audit';
import type { Db, Tx } from '../db/client';
import { AppError } from '../errors';
import { parseInput } from '../validation';
import { inAgency } from './index';
import { pacificDateTimeToUtc } from './pacific-time';
import { productionSimulationRefused } from './production-guard';
import { campaignPlan, campaignStop, type CampaignStep } from './campaign-policy';
type Options = { db?: Db; now?: Date };
type Progress = {
  contact_id: string;
  step_index: number;
  due_at: string;
  state: string;
  stop_reason: string | null;
  enrolled_at: string;
};
async function stopped(tx: Tx, id: string, since: string) {
  const [f] = await tx.execute<{
    deleted: boolean;
    optedOut: boolean;
    replied: boolean;
    booked: boolean;
    closed: boolean;
  }>(sql`
 select c.deleted_at is not null or c.merged_into_id is not null as deleted,
 (c.do_not_call_at is not null or exists(select 1 from consents s where s.contact_id=c.id and (s.kind in ('dnc','opt_out') or s.revoked_at is not null)) or exists(select 1 from dnc_entries d where d.e164=any(c.phones) and d.removed_at is null)) as "optedOut",
 (exists(select 1 from messages m where m.contact_id=c.id and m.direction='inbound' and m.created_at>=${since}) or exists(select 1 from agency_dm_logs d where d.contact_id=c.id and d.direction='inbound' and d.occurred_at>=${since})) as replied,
 exists(select 1 from appointments a where a.contact_id=c.id and a.status in ('scheduled','completed')) as booked,
 exists(select 1 from deal_contacts dc join deals d on d.id=dc.deal_id join pipeline_stages s on s.id=d.stage_id where dc.contact_id=c.id and d.deleted_at is null and (s.is_won or s.is_lost)) as closed
 from contacts c where c.id=${id}`);
  return f ? campaignStop(f) : 'contact_unavailable';
}
export async function setAgencyCampaignPlan(
  caller: StaffCaller,
  id: string,
  raw: unknown,
  opts: Options = {}
) {
  parseInput(z.uuid(), id);
  const steps = parseInput(campaignPlan, raw);
  return inAgency(
    caller,
    async (tx) => {
      const c = await tx.execute(sql`select id from agency_campaigns where id=${id} for update`);
      if (!c.length) throw new AppError('NOT_FOUND');
      const active = await tx.execute(
        sql`select contact_id from agency_campaign_progress where campaign_id=${id}`
      );
      if (active.length)
        throw new AppError('CONFLICT', {
          message: 'Create a new campaign to change an enrolled sequence.'
        });
      await tx.execute(
        sql`update agency_campaigns set steps=${JSON.stringify(steps)}::jsonb where id=${id}`
      );
    },
    opts
  );
}
export async function startAgencyCampaign(caller: StaffCaller, id: string, opts: Options = {}) {
  parseInput(z.uuid(), id);
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const [c] = await tx.execute<{ steps: CampaignStep[] }>(
        sql`select steps from agency_campaigns where id=${id} for update`
      );
      if (!c) throw new AppError('NOT_FOUND');
      const steps = parseInput(campaignPlan, c.steps);
      const now = opts.now ?? new Date(),
        due = new Date(now.getTime() + steps[0].delayDays * 86400000).toISOString();
      const inserted =
        await tx.execute(sql`insert into agency_campaign_progress(tenant_id,campaign_id,contact_id,due_at,enrolled_at)
   select tenant_id,campaign_id,contact_id,${due},${now.toISOString()} from agency_campaign_leads where campaign_id=${id}
   on conflict do nothing returning contact_id`);
      return { enrolled: inserted.length, providerRequests: 0 };
    },
    opts
  );
}
export async function listAgencyCampaignTasks(caller: StaffCaller, id: string, opts: Options = {}) {
  parseInput(z.uuid(), id);
  return inAgency(
    caller,
    async (tx) =>
      Array.from(
        await tx.execute<Progress & { name: string }>(
          sql`select p.*,c.first_name as name from agency_campaign_progress p join contacts c on c.id=p.contact_id where p.campaign_id=${id} order by p.due_at,p.contact_id limit 100`
        )
      ),
    opts
  );
}
/** Human completion only. No step sends a call, text, or email. */
export async function advanceAgencyCampaign(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const i = parseInput(
    z
      .strictObject({
        campaignId: z.uuid(),
        contactId: z.uuid(),
        stepIndex: z.number().int().min(0),
        mode: z.enum(['simulate', 'manual_complete', 'done', 'skip', 'reschedule']),
        reason: z.string().trim().min(1).max(500).optional(),
        callbackDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        callbackTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional()
      })
      .superRefine((value, ctx) => {
        if (value.mode === 'skip' && !value.reason)
          ctx.addIssue({ code: 'custom', path: ['reason'], message: 'reason_required' });
        if (value.mode === 'reschedule' && (!value.callbackDate || !value.callbackTime))
          ctx.addIssue({ code: 'custom', path: ['callbackDate'], message: 'reschedule_required' });
      }),
    raw
  );
  if (i.mode === 'simulate' && productionSimulationRefused())
    throw new AppError('FORBIDDEN', {
      message: 'Simulated campaign steps are not available in production.'
    });
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const [p] = await tx.execute<Progress>(
        sql`select * from agency_campaign_progress where campaign_id=${i.campaignId} and contact_id=${i.contactId} for update`
      );
      if (!p) throw new AppError('NOT_FOUND');
      if (p.step_index !== i.stepIndex || p.state !== 'active')
        return { status: p.state, duplicate: true, providerRequests: 0 };
      const reason = await stopped(tx, i.contactId, p.enrolled_at);
      if (reason) {
        await tx.execute(
          sql`update agency_campaign_progress set state='stopped',stop_reason=${reason} where campaign_id=${i.campaignId} and contact_id=${i.contactId}`
        );
        return { status: 'stopped', reason, providerRequests: 0 };
      }
      const now = opts.now ?? new Date();
      if (Date.parse(p.due_at) > now.getTime() && i.mode !== 'reschedule')
        return { status: 'not_due', providerRequests: 0 };
      const [c] = await tx.execute<{ steps: CampaignStep[] }>(
        sql`select steps from agency_campaigns where id=${i.campaignId}`
      );
      const steps = parseInput(campaignPlan, c.steps),
        step = steps[p.step_index];
      if (!step) throw new AppError('CONFLICT');
      const result =
        i.mode === 'simulate'
          ? 'simulated'
          : i.mode === 'manual_complete'
            ? 'manual_complete'
            : i.mode === 'skip'
              ? 'skipped'
              : i.mode === 'reschedule'
                ? 'rescheduled'
                : 'done';
      let due = new Date(now.getTime() + (steps[p.step_index + 1]?.delayDays ?? 0) * 86400000);
      if (i.mode === 'reschedule') {
        try {
          due = new Date(pacificDateTimeToUtc(i.callbackDate!, i.callbackTime!));
        } catch {
          throw new AppError('VALIDATION_FAILED', { fieldErrors: { callbackDate: ['invalid'] } });
        }
      }
      const note =
        i.mode === 'skip'
          ? i.reason!
          : i.mode === 'reschedule'
            ? `${i.callbackDate} ${i.callbackTime} America/Los_Angeles`
            : null;
      await tx.execute(
        sql`insert into agency_campaign_history(tenant_id,campaign_id,contact_id,step_index,channel,result,recorded_by,note,recorded_at) values(${tenantId},${i.campaignId},${i.contactId},${p.step_index},${step.channel},${result},${caller.id},${note},${now.toISOString()})`
      );
      const next = i.mode === 'reschedule' ? p.step_index : p.step_index + 1;
      const state =
        i.mode === 'reschedule' ? 'active' : next >= steps.length ? 'complete' : 'active';
      const dueIso = due.toISOString();
      await tx.execute(
        sql`update agency_campaign_progress set step_index=${next},state=${state},due_at=${dueIso} where campaign_id=${i.campaignId} and contact_id=${i.contactId}`
      );
      await audit(tx, {
        action: 'agency.campaign.step',
        entity: 'contact',
        entityId: i.contactId,
        after: {
          campaignId: i.campaignId,
          stepIndex: p.step_index,
          outcome: result,
          actor: caller.id
        }
      });
      return { status: state, providerRequests: 0 };
    },
    opts
  );
}
export async function agencyCampaignStats(caller: StaffCaller, id: string, opts: Options = {}) {
  parseInput(z.uuid(), id);
  return inAgency(
    caller,
    async (tx) =>
      Array.from(
        await tx.execute<{ result: string; count: number }>(
          sql`select result,count(*)::int as count from agency_campaign_history where campaign_id=${id} group by result order by result`
        )
      ),
    opts
  );
}
