import { and, eq, isNull, sql } from 'drizzle-orm';
import { getWorkerDb } from '../db/client';
import { deals, notifications, appointments, pipelineStages } from '../db/schema';
import { notify } from '../notifications';
import { subscribe } from '../events';
import { withTenant } from '../tenancy';

async function notifyOnce(
  tx: Parameters<typeof notify>[0],
  kind: 'deal_won' | 'hot_lead',
  link: string,
  title: string,
  body: string
) {
  const [existing] = await tx
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.kind, kind), eq(notifications.link, link)))
    .limit(1);
  if (!existing) await notify(tx, { type: kind, userId: null, title, body, link });
}

export function registerStageRuleSubscribers() {
  subscribe('deal.won', 'm7-deal-won-alert', async (env) => {
    const dealId = env.payload.dealId;
    if (typeof dealId !== 'string') return;
    await withTenant(
      { tenantId: env.tenantId, role: 'system' },
      (tx) =>
        notifyOnce(
          tx,
          'deal_won',
          `/dashboard/deals/${dealId}`,
          'Deal won',
          'A deal has moved to Won.'
        ),
      { db: getWorkerDb() }
    );
  });
  subscribe('call.completed', 'm7-hot-lead-alert', async (env) => {
    if (env.payload.outcome !== 'booked' && env.payload.outcome !== 'qualified') return;
    const contactId = env.payload.contactId;
    if (typeof contactId !== 'string') return;
    await withTenant(
      { tenantId: env.tenantId, role: 'system' },
      (tx) =>
        notifyOnce(
          tx,
          'hot_lead',
          `/dashboard/contacts/${contactId}`,
          'Hot lead',
          'Alex reached a promising lead.'
        ),
      { db: getWorkerDb() }
    );
  });
  subscribe('appointment.booked', 'm7-booking-stage-rule', async (env) => {
    const appointmentId = env.payload.appointmentId;
    if (typeof appointmentId !== 'string') return;
    await withTenant(
      { tenantId: env.tenantId, role: 'system' },
      async (tx) => {
        const [appointment] = await tx
          .select({ dealId: appointments.dealId })
          .from(appointments)
          .where(eq(appointments.id, appointmentId))
          .limit(1);
        if (!appointment?.dealId) return;
        const [deal] = await tx
          .select()
          .from(deals)
          .where(and(eq(deals.id, appointment.dealId), isNull(deals.deletedAt)))
          .limit(1);
        if (!deal) return;
        const [booked] = await tx
          .select({ id: pipelineStages.id })
          .from(pipelineStages)
          .where(
            and(
              eq(pipelineStages.pipelineId, deal.pipelineId),
              sql`lower(${pipelineStages.name}) = 'estimate booked'`
            )
          )
          .limit(1);
        if (!booked || booked.id === deal.stageId) return;
        await tx
          .update(deals)
          .set({ stageId: booked.id, updatedAt: new Date().toISOString() })
          .where(eq(deals.id, deal.id));
      },
      { db: getWorkerDb() }
    );
  });
}
