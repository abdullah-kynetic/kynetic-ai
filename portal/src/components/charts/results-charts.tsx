"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { date: string; leads: number; calls: number; bookings: number; minutesUsed: number; avgSpeedToLeadSec: number | null };
const tick = { fill: "#a0a0a0", fontSize: 11 };
const tip = { contentStyle: { background: "#1e1e1e", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "#fff" }, cursor: { stroke: "rgba(255,255,255,.15)" } };
const short = (d: string) => d.slice(5);

function Frame({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 text-sm font-medium">{title}</div>
      <div className="h-52"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </div>
  );
}

export function ResultsCharts({ rows }: { rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Frame title="Speed to lead (seconds)">
        <LineChart data={rows} margin={{ left: -16, right: 8, top: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} tick={tick} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} />
          <Tooltip {...tip} formatter={(v) => [`${v}s`, "Avg speed"]} />
          <Line type="monotone" dataKey="avgSpeedToLeadSec" stroke="#e879f9" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </Frame>
      <Frame title="Leads & bookings per day">
        <BarChart data={rows} margin={{ left: -16, right: 8, top: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} tick={tick} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip {...tip} />
          <Bar dataKey="leads" name="Leads" fill="#7c3aed" radius={[3, 3, 0, 0]} />
          <Bar dataKey="bookings" name="Bookings" fill="#22c55e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </Frame>
      <Frame title="Calls per day">
        <AreaChart data={rows} margin={{ left: -16, right: 8, top: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} tick={tick} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip {...tip} />
          <Area type="monotone" dataKey="calls" name="Calls" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </Frame>
      <Frame title="Minutes used per day">
        <BarChart data={rows} margin={{ left: -16, right: 8, top: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} tick={tick} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} />
          <Tooltip {...tip} />
          <Bar dataKey="minutesUsed" name="Minutes" fill="#b70dc6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </Frame>
    </div>
  );
}
