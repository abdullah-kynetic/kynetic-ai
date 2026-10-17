import { ResultsCharts } from "@/components/charts/results-charts";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Stat } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatNumber } from "@/lib/utils";
import { BarChart3 } from "lucide-react";
import type { ResultsSummary } from "@/lib/data/results";

export function MinutesBar({ month }: { month: ResultsSummary["month"] }) {
  const tone = month.pct >= 100 ? "danger" : month.pct >= 80 ? "warning" : "brand";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div><div className="text-xs uppercase tracking-wide text-subtle">Minutes used · {month.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(month.minutesUsed, 1)} <span className="text-sm font-normal text-muted">of {formatNumber(month.includedMinutes)} included</span></div></div>
        <div className="text-sm tabular-nums text-muted">{month.pct}%</div>
      </div>
      <Progress value={Math.min(100, month.pct)} tone={tone} className="mt-3" />
    </div>
  );
}

export function ResultsView({ data, compact }: { data: ResultsSummary; compact?: boolean }) {
  const t = data.totals;
  if (!data.rows.length) return <EmptyState icon={BarChart3} title="No results yet" description="Results appear here once your agents start handling leads." />;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Avg speed to lead" value={t.avgSpeedToLeadSec === null ? "—" : `${formatNumber(t.avgSpeedToLeadSec, 1)}s`} hint="Last 30 days" />
        <Stat label="Leads" value={formatNumber(t.leads)} hint="Last 30 days" />
        <Stat label="Calls" value={formatNumber(t.calls)} hint="Last 30 days" />
        <Stat label="Bookings" value={formatNumber(t.bookings)} hint="Last 30 days" />
        <Stat label="Booking rate" value={t.bookingRate === null ? "—" : `${t.bookingRate}%`} hint="Bookings ÷ leads" className="col-span-2 lg:col-span-1" />
      </div>
      <MinutesBar month={data.month} />
      <ResultsCharts rows={data.rows} />
      {compact ? null : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <Table>
            <THead><TR><TH>Date</TH><TH className="text-right">Leads</TH><TH className="text-right">Calls</TH><TH className="text-right">Bookings</TH><TH className="text-right">Minutes</TH><TH className="text-right">Speed (s)</TH></TR></THead>
            <TBody>
              {[...data.rows].reverse().map((r) => (
                <TR key={r.date}><TD>{formatDate(r.date)}</TD><TD className="text-right tabular-nums">{r.leads}</TD><TD className="text-right tabular-nums">{r.calls}</TD><TD className="text-right tabular-nums">{r.bookings}</TD><TD className="text-right tabular-nums">{formatNumber(r.minutesUsed, 1)}</TD><TD className="text-right tabular-nums">{r.avgSpeedToLeadSec ?? "—"}</TD></TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
