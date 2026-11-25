import { and, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { appointments, automationRuns, calls, tasks, tenants } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import { loadJobCards } from './jobs';
import { dayStart, getMoney, weekStart } from './money';

const DAY_MS = 86_400_000;

export type NeedsYouItem = {
  kind: 'pickup' | 'insurance' | 'quote' | 'task' | 'lead';
  label: string;
  detail: string;
  href: string;
};

export type TodayView = {
  tiles: {
    carsInShop: number;
    dropOffsToday: number;
    newLeads: number;
    quotesWaiting: number;
    moneyInWeekCents: number;
    callsAnsweredWeek: number;
  };
  needsYou: NeedsYouItem[];
  runningWithoutYou: { label: string; detail: string }[];
};

const CARS_IN_SHOP = [
  'Waiting on insurance',
  'Parts ordered',
  'In repair and paint',
  'Ready for pickup'
];

/** Appointment type is the first word of `notes` ("drop-off: ...", "estimate: ...", "pickup: ..."). */
export function appointmentKind(
  notes: string | null
): 'drop-off' | 'estimate' | 'pickup' | 'other' {
  const head = (notes ?? '').split(':')[0]!.trim().toLowerCase();
  return head === 'drop-off' || head === 'estimate' || head === 'pickup' ? head : 'other';
}

/** Everything on the Today page, from real queries. Nothing here is invented. */
export async function getToday(ctx: TenantContextInput, opts: ShopOpts = {}): Promise<TodayView> {
  const now = opts.now ?? new Date();
  const money = await getMoney(ctx, opts);
  return shopRun(ctx, opts, async (tx) => {
    const [tenant] = await tx
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`))
      .limit(1);
    const zone = tenant?.timezone ?? 'America/Chicago';
    const today = dayStart(now, zone);
    const tomorrow = new Date(today.getTime() + 25 * 3_600_000);
    const tomorrowStart = dayStart(tomorrow, zone);
    const week = weekStart(now, zone);
    const { stages, cards } = await loadJobCards(tx, now);
    const open = cards.filter((c) => {
      const s = stages.find((x) => x.id === c.stageId);
      return s && !s.isWon && !s.isLost;
    });
    const apptRows = await tx
      .select({ notes: appointments.notes, startsAt: appointments.startsAt })
      .from(appointments)
      .where(
        and(
          gte(appointments.startsAt, today.toISOString()),
          lt(appointments.startsAt, tomorrowStart.toISOString()),
          ne(appointments.status, 'cancelled')
        )
      );
    const [answered] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(calls)
      .where(
        and(
          eq(calls.direction, 'inbound'),
          gte(calls.startedAt, week.toISOString()),
          sql`${calls.outcome} is not null and ${calls.outcome} <> 'no_answer'`
        )
      );
    const dueTasks = await tx
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(
        and(
          isNull(tasks.completedAt),
          isNull(tasks.deletedAt),
          lt(tasks.dueAt, tomorrowStart.toISOString())
        )
      )
      .orderBy(tasks.dueAt)
      .limit(5);
    const [runs] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(automationRuns)
      .where(eq(automationRuns.status, 'active'));
    const [reminders] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          gte(appointments.startsAt, now.toISOString()),
          lt(appointments.startsAt, new Date(now.getTime() + 3 * DAY_MS).toISOString()),
          inArray(appointments.status, ['scheduled'])
        )
      );
    const needsYou: NeedsYouItem[] = [];
    for (const c of open.filter((j) => j.stageName === 'Ready for pickup'))
      needsYou.push({
        kind: 'pickup',
        label: `${c.vehicleLabel || c.title} is ready for pickup`,
        detail: c.customerName ?? 'Customer not set',
        href: '/dashboard/shop/jobs'
      });
    for (const c of open.filter((j) => j.stageName === 'Waiting on insurance' && j.daysInShop >= 3))
      needsYou.push({
        kind: 'insurance',
        label: `${c.vehicleLabel || c.title} has waited ${c.daysInShop} days on insurance`,
        detail: [c.insurer, c.claimNumber].filter(Boolean).join(' · ') || 'No claim details yet',
        href: '/dashboard/shop/insurance'
      });
    for (const c of open.filter((j) => j.stageName === 'Quoted').slice(0, 5)) {
      const age = Math.floor((now.getTime() - new Date(c.updatedAt).getTime()) / DAY_MS);
      if (age >= 3)
        needsYou.push({
          kind: 'quote',
          label: `Quote for ${c.customerName ?? c.title} is ${age} days old`,
          detail: c.vehicleLabel || c.title,
          href: '/dashboard/shop/quotes'
        });
    }
    for (const t of dueTasks)
      needsYou.push({
        kind: 'task',
        label: t.title,
        detail: 'Task due',
        href: '/dashboard/leads/tasks'
      });
    for (const c of open.filter((j) => j.stageName === 'New lead').slice(0, 3))
      needsYou.push({
        kind: 'lead',
        label: `New lead: ${c.customerName ?? c.title}`,
        detail: c.vehicleLabel || c.title,
        href: '/dashboard/shop/leads'
      });
    const running: TodayView['runningWithoutYou'] = [];
    if ((runs?.n ?? 0) > 0)
      running.push({
        label: `${runs!.n} quote follow-up${runs!.n === 1 ? '' : 's'} waiting to go out`,
        detail: 'Follow-up stops when the customer replies or the job is won or lost.'
      });
    if ((reminders?.n ?? 0) > 0)
      running.push({
        label: `${reminders!.n} appointment${reminders!.n === 1 ? '' : 's'} in the next 3 days`,
        detail: 'Each one gets a reminder before it.'
      });
    return {
      tiles: {
        carsInShop: open.filter((j) => CARS_IN_SHOP.includes(j.stageName)).length,
        dropOffsToday: apptRows.filter((a) => appointmentKind(a.notes) === 'drop-off').length,
        newLeads: open.filter((j) => j.stageName === 'New lead').length,
        quotesWaiting: open.filter((j) => j.stageName === 'Quoted').length,
        moneyInWeekCents: money.totals.weekInCents,
        callsAnsweredWeek: answered?.n ?? 0
      },
      needsYou,
      runningWithoutYou: running
    };
  });
}
