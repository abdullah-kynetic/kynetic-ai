import Link from "next/link";
import { getClients } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  active: "#5ed67e",
  paused: "#f5b95e",
  churned: "#f56e6e",
};

export default async function Page() {
  const clients = await getClients();
  const totalMrr = clients.reduce((sum, c) => sum + c.mrr, 0);
  const active = clients.filter((c) => c.status === "active").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">All Clients</h1>
        <p className="text-sm text-muted">
          {clients.length} clients · {active} active · {formatCurrency(totalMrr)} MRR
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Industry</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">MRR</th>
              <th className="px-4 py-3 font-medium">Contract start</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted">{c.industry}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize" style={{ color: STATUS_COLOR[c.status] }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[c.status] }} />
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">{formatCurrency(c.mrr)}</td>
                <td className="px-4 py-3 text-muted">{formatDate(c.contractStart)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/clients/${c.id}`} className="text-xs font-medium text-accent hover:underline">
                    View detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
