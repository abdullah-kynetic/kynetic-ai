import { getReports } from "@/lib/queries";
import StatCard from "@/components/StatCard";
import { formatCurrency } from "@/lib/types";

function monthLabel(month: string) {
  const [year, m] = month.split("-");
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function ReportsView({ clientId }: { clientId: number }) {
  const reports = await getReports(clientId);
  const [current, ...archive] = reports;

  if (!current) return <p className="text-sm text-muted">No reports yet.</p>;

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">{monthLabel(current.month)}</h2>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Current</span>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Calls answered" value={String(current.callsAnswered)} />
          <StatCard label="Jobs booked" value={String(current.jobsBooked)} />
          <StatCard label="Revenue recovered" value={formatCurrency(current.revenueRecovered)} />
          <StatCard label="Missed calls saved" value={String(current.missedCallsSaved)} />
          <StatCard label="Reviews gained" value={String(current.reviewsGained)} />
        </div>
        <p className="text-sm text-muted">{current.summary}</p>
      </div>

      {archive.length > 0 && (
        <div className="rounded-xl border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-3 text-sm font-medium">Past reports</h2>
          <div className="divide-y divide-border">
            {archive.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="text-sm font-medium">{monthLabel(r.month)}</span>
                <span className="text-xs text-muted">
                  {r.callsAnswered} calls · {r.jobsBooked} booked · {formatCurrency(r.revenueRecovered)} recovered
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
