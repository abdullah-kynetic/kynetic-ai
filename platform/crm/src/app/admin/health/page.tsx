import Link from "next/link";
import { getClients } from "@/lib/queries";
import { STATUS_COLOR, type WorkflowStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: WorkflowStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize" style={{ color: STATUS_COLOR[status] }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      {status}
    </span>
  );
}

export default async function Page() {
  const clients = await getClients();
  const issues = clients.filter(
    (c) => c.receptionistStatus !== "running" || c.reviewAutomationStatus !== "running" || c.nurtureStatus !== "running"
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">System Health</h1>
        <p className="text-sm text-muted">
          {issues.length > 0 ? `${issues.length} client${issues.length === 1 ? "" : "s"} need attention` : "Everything is running clean"}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Receptionist</th>
              <th className="px-4 py-3 font-medium">Review automation</th>
              <th className="px-4 py-3 font-medium">Nurture sequence</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3"><StatusPill status={c.receptionistStatus} /></td>
                <td className="px-4 py-3"><StatusPill status={c.reviewAutomationStatus} /></td>
                <td className="px-4 py-3"><StatusPill status={c.nurtureStatus} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/clients/${c.id}`} className="text-xs font-medium text-accent hover:underline">
                    Inspect
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
