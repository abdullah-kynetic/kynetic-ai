"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, STAGES, type Lead } from "@/lib/leads";

export default function AnalyticsCharts({ leads }: { leads: Lead[] }) {
  const totalValue = leads.reduce((sum, l) => sum + l.value, 0);
  const won = leads.filter((l) => l.stage === "won");
  const lost = leads.filter((l) => l.stage === "lost");
  const wonValue = won.reduce((sum, l) => sum + l.value, 0);
  const closed = won.length + lost.length;
  const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0;

  const byStage = STAGES.map((s) => ({
    stage: s.label,
    color: s.color,
    count: leads.filter((l) => l.stage === s.key).length,
    value: leads.filter((l) => l.stage === s.key).reduce((sum, l) => sum + l.value, 0),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted">Live view across your entire pipeline.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total leads" value={String(leads.length)} />
        <StatCard label="Pipeline value" value={formatCurrency(totalValue)} />
        <StatCard label="Won value" value={formatCurrency(wonValue)} />
        <StatCard label="Win rate" value={`${winRate}%`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-medium">Leads by stage</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byStage}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {byStage.map((entry) => (
                  <Cell key={entry.stage} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-medium">Pipeline value by stage</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={byStage.filter((s) => s.value > 0)}
                dataKey="value"
                nameKey="stage"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
              >
                {byStage.filter((s) => s.value > 0).map((entry) => (
                  <Cell key={entry.stage} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3">
            {byStage.filter((s) => s.value > 0).map((s) => (
              <div key={s.stage} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.stage}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
