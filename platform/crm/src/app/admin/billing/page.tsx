import { getClients } from "@/lib/queries";
import StatCard from "@/components/StatCard";
import { formatCurrency } from "@/lib/types";

export const dynamic = "force-dynamic";

const STRIPE_COLOR: Record<string, string> = {
  paid: "#5ed67e",
  overdue: "#f56e6e",
  canceled: "#9497b8",
};

export default async function Page() {
  const clients = await getClients();
  const totalMrr = clients.reduce((sum, c) => sum + c.mrr, 0);
  const overdue = clients.filter((c) => c.stripeStatus === "overdue");
  const overdueMrr = overdue.reduce((sum, c) => sum + c.mrr, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted">Stripe status across all clients.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total MRR" value={formatCurrency(totalMrr)} />
        <StatCard label="Overdue accounts" value={String(overdue.length)} />
        <StatCard label="Overdue MRR at risk" value={formatCurrency(overdueMrr)} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">MRR</th>
              <th className="px-4 py-3 font-medium">Stripe status</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{formatCurrency(c.mrr)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize" style={{ color: STRIPE_COLOR[c.stripeStatus] }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STRIPE_COLOR[c.stripeStatus] }} />
                    {c.stripeStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
