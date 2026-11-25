import { and, asc, eq, gte, lt, ne, sql } from 'drizzle-orm';
import { appointments, automations, contacts, tenants } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import { loadJobCards } from './jobs';
import { dayStart, weekStart } from './money';
import { appointmentKind } from './today';

export type CalendarItem = {
  id: string;
  kind: 'drop-off' | 'estimate' | 'pickup' | 'other';
  startsAt: string;
  endsAt: string;
  status: string;
  customerName: string | null;
  contactId: string | null;
  vehicleLabel: string;
  note: string | null;
};
export type CalendarDay = { key: string; start: string; items: CalendarItem[] };
export type CalendarWeek = {
  from: string;
  to: string;
  timeZone: string;
  days: CalendarDay[];
  /** True when the appointment reminders automation is switched on for this client. */
  remindersOn: boolean;
};

/** The week (Monday to Sunday) that contains `anchor`, or this week. `anchor` is a YYYY-MM-DD in the shop's zone. */
export async function getShopCalendar(
  ctx: TenantContextInput,
  opts: ShopOpts & { anchor?: string } = {}
): Promise<CalendarWeek> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const [tenant] = await tx
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`))
      .limit(1);
    const zone = tenant?.timezone ?? 'America/Chicago';
    const anchorInstant =
      opts.anchor && /^\d{4}-\d{2}-\d{2}$/.test(opts.anchor)
        ? new Date(`${opts.anchor}T12:00:00Z`)
        : now;
    const start = weekStart(anchorInstant, zone);
    const dayStarts: Date[] = [];
    for (let i = 0; i < 7; i++)
      dayStarts.push(dayStart(new Date(start.getTime() + i * 86_400_000 + 12 * 3_600_000), zone));
    const end = dayStart(new Date(dayStarts[6]!.getTime() + 36 * 3_600_000), zone);
    const rows = await tx
      .select({
        id: appointments.id,
        contactId: appointments.contactId,
        dealId: appointments.dealId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        notes: appointments.notes,
        first: contacts.firstName,
        last: contacts.lastName
      })
      .from(appointments)
      .leftJoin(contacts, eq(contacts.id, appointments.contactId))
      .where(
        and(
          gte(appointments.startsAt, start.toISOString()),
          lt(appointments.startsAt, end.toISOString()),
          ne(appointments.status, 'cancelled')
        )
      )
      .orderBy(asc(appointments.startsAt));
    const dealIds = rows.map((r) => r.dealId).filter((d): d is string => !!d);
    const { cards } = dealIds.length ? await loadJobCards(tx, now) : { cards: [] };
    const [reminder] = await tx
      .select({ enabled: automations.enabled })
      .from(automations)
      .where(
        and(eq(automations.kind, 'template'), eq(automations.templateKey, 'appointment_reminders'))
      )
      .limit(1);
    const days: CalendarDay[] = dayStarts.map((d, i) => {
      const next = i < 6 ? dayStarts[i + 1]! : end;
      return {
        key: d.toLocaleDateString('en-CA', { timeZone: zone }),
        start: d.toISOString(),
        items: rows
          .filter((r) => new Date(r.startsAt) >= d && new Date(r.startsAt) < next)
          .map((r) => ({
            id: r.id,
            kind: appointmentKind(r.notes),
            startsAt: r.startsAt,
            endsAt: r.endsAt,
            status: r.status,
            customerName: r.first ? `${r.first} ${r.last ?? ''}`.trim() : null,
            contactId: r.contactId,
            vehicleLabel: cards.find((c) => c.id === r.dealId)?.vehicleLabel ?? '',
            note: r.notes?.includes(':')
              ? r.notes.split(':').slice(1).join(':').trim() || null
              : r.notes
          }))
      };
    });
    return {
      from: days[0]!.key,
      to: days[6]!.key,
      timeZone: zone,
      days,
      remindersOn: reminder?.enabled === true
    };
  });
}
