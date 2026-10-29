import { and, asc, eq, gte, lt } from 'drizzle-orm';
import type { Db, Tx } from '../db/client';
import { metricsDaily, reports } from '../db/schema';
import { audit } from '../audit';
import { emitEvent } from '../events';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';
import { z } from 'zod';
import { isModuleEnabled } from '../modules';
import { presenceReport } from '../presence';

export const reportPeriodSchema = z.string().regex(/^\d{4}-\d{2}-01$/, 'period_start');
export type MonthlyReport = typeof reports.$inferSelect;
export type ReportSection = {
  key: string;
  title: string;
  render: (days: (typeof metricsDaily.$inferSelect)[]) => Record<string, unknown>;
};
export const REPORT_SECTIONS: readonly ReportSection[] = [
  {
    key: 'performance',
    title: 'Performance',
    render: (days) => ({
      leads: days.reduce((n, d) => n + d.leads, 0),
      calls: days.reduce((n, d) => n + d.calls, 0),
      booked: days.reduce((n, d) => n + d.estimatesBooked, 0)
    })
  },
  {
    key: 'revenue',
    title: 'Revenue recovered',
    render: (days) => ({
      revenueCents: days.reduce((n, d) => n + d.wonRevenueCents, 0),
      bookedValueCents: days.reduce((n, d) => n + d.bookedValueCents, 0)
    })
  }
];

export async function generateMonthlyReport(
  ctx: TenantContextInput,
  periodStart: string,
  opts: { db?: Db; tx?: Tx } = {}
) {
  const period = parseInput(reportPeriodSchema, periodStart);
  const start = new Date(`${period}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const run = async (tx: Tx) => {
    const days = await tx
      .select()
      .from(metricsDaily)
      .where(
        and(gte(metricsDaily.day, period), lt(metricsDaily.day, end.toISOString().slice(0, 10)))
      )
      .orderBy(asc(metricsDaily.day));
    const sections = Object.fromEntries(
      REPORT_SECTIONS.map((section) => [
        section.key,
        { title: section.title, data: section.render(days) }
      ])
    );
    if (await isModuleEnabled(ctx, 'opm', { tx })) {
      const presence = await presenceReport(ctx, period, { tx });
      sections.online_presence = {
        title: 'Online Presence',
        data: { snapshots: presence.snapshots.map(({ source, capturedOn, reviewCount, averageRating }) => ({ source, capturedOn, reviewCount, averageRating })) }
      };
    }
    const [row] = await tx
      .insert(reports)
      .values({
        tenantId: ctx.tenantId,
        kind: 'monthly_roi',
        periodStart: period,
        status: 'ready',
        storageKey: `${ctx.tenantId}/reports/${period}.json`
      })
      .onConflictDoUpdate({
        target: [reports.tenantId, reports.kind, reports.periodStart],
        set: { status: 'ready', error: null }
      })
      .returning();
    await audit(tx, {
      action: 'report.generate',
      entity: 'report',
      entityId: row.id,
      after: { periodStart: period, days: days.length }
    });
    await emitEvent(tx, {
      name: 'report.ready',
      tenantId: ctx.tenantId,
      actor: { type: 'system' },
      payload: { reportId: row.id, periodStart: period }
    });
    return { report: row, days, sections };
  };
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}

export function listReports(ctx: TenantContextInput, opts: { db?: Db; tx?: Tx } = {}) {
  const run = (tx: Tx) => tx.select().from(reports).orderBy(reports.periodStart);
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}

export function getReport(ctx: TenantContextInput, id: string, opts: { db?: Db; tx?: Tx } = {}) {
  const run = async (tx: Tx) => {
    const [row] = await tx.select().from(reports).where(eq(reports.id, id)).limit(1);
    return row ?? null;
  };
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}
