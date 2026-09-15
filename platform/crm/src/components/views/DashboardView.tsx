import { getReports } from "@/lib/queries";
import StatCard from "@/components/StatCard";
import { formatCurrency } from "@/lib/types";

export default async function DashboardView({ clientId }: { clientId: number }) {
  const reports = await getReports(clientId);
  const current = reports[0];

  if (!current) {
    return <p className="text-sm text-muted">No report data yet.</p>;
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Calls answered this month" value={String(current.callsAnswered)} />
        <StatCard label="Jobs booked" value={String(current.jobsBooked)} />
        <StatCard label="Revenue recovered" value={formatCurrency(current.revenueRecovered)} />
        <StatCard
          label="Missed calls avoided"
          value={String(current.missedCallsSaved)}
          hint="would've gone unanswered without the receptionist"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium">This month, in plain terms</h2>
        <p className="text-sm text-muted">{current.summary}</p>
      </div>
    </div>
  );
}
