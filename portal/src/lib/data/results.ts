import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { dailyResults } from "../db/schema";
import type { Tx } from "../db/scoped";

export type ResultRow = { date: string; leads: number; calls: number; bookings: number; minutesUsed: number; avgSpeedToLeadSec: number | null };
export type ResultsSummary = {
  rows: ResultRow[];
  totals: { leads: number; calls: number; bookings: number; minutesUsed: number; avgSpeedToLeadSec: number | null; bookingRate: number | null };
  month: { minutesUsed: number; includedMinutes: number; pct: number; label: string };
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Results for ONE client (caller passes the session/admin-resolved clientId; RLS also enforces it). */
export async function loadResults(tx: Tx, clientId: string, includedMinutes: number, days = 30): Promise<ResultsSummary> {
  const since = new Date(); since.setUTCDate(since.getUTCDate() - (days - 1));
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const from = since < monthStart ? since : monthStart;
  const raw = await tx.select().from(dailyResults)
    .where(and(eq(dailyResults.clientId, clientId), gte(dailyResults.date, iso(from))))
    .orderBy(asc(dailyResults.date));
  const all: ResultRow[] = raw.map((r) => ({
    date: r.date, leads: r.leads, calls: r.calls, bookings: r.bookings,
    minutesUsed: Number(r.minutesUsed), avgSpeedToLeadSec: r.avgSpeedToLeadSec === null ? null : Number(r.avgSpeedToLeadSec),
  }));
  const rows = all.filter((r) => r.date >= iso(since));
  const sum = (k: "leads" | "calls" | "bookings" | "minutesUsed") => rows.reduce((a, r) => a + r[k], 0);
  const weighted = rows.filter((r) => r.avgSpeedToLeadSec !== null && r.leads > 0);
  const wLeads = weighted.reduce((a, r) => a + r.leads, 0);
  const avg = wLeads ? weighted.reduce((a, r) => a + r.avgSpeedToLeadSec! * r.leads, 0) / wLeads : null;
  const leads = sum("leads");
  const monthUsed = all.filter((r) => r.date >= iso(monthStart)).reduce((a, r) => a + r.minutesUsed, 0);
  return {
    rows,
    totals: { leads, calls: sum("calls"), bookings: sum("bookings"), minutesUsed: round(sum("minutesUsed")), avgSpeedToLeadSec: avg === null ? null : round(avg), bookingRate: leads ? round((sum("bookings") / leads) * 100) : null },
    month: { minutesUsed: round(monthUsed), includedMinutes, pct: includedMinutes ? Math.min(999, round((monthUsed / includedMinutes) * 100)) : 0, label: monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) },
  };
}
const round = (n: number) => Math.round(n * 10) / 10;
