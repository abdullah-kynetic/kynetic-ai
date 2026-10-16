import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listClients, portfolioTotals, recentActivity } from "@/lib/data/admin";
import { PageHeader, Stat } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatDate, formatNumber, relativeTime } from "@/lib/utils";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";
const variant = { onboarding: "info", active: "success", paused: "warning" } as const;

export default async function AdminHome() {
  const s = await requireAdmin();
  const [clients, totals, activity] = await Promise.all([listClients(s), portfolioTotals(s), recentActivity(s, 12)]);
  return (
    <>
      <PageHeader title="Clients" description="All client accounts." badge={<Badge variant="brand">Admin</Badge>}
        actions={<Link href="/admin/clients/new" className={cn(buttonVariants())}><Plus />New client</Link>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clients" value={clients.length} /><Stat label="Leads · 30d" value={formatNumber(totals.leads)} />
        <Stat label="Bookings · 30d" value={formatNumber(totals.bookings)} /><Stat label="Minutes · 30d" value={formatNumber(totals.minutes, 0)} />
      </div>
      {clients.length === 0 ? <EmptyState icon={Users} title="No clients yet" action={<Link href="/admin/clients/new" className={cn(buttonVariants())}>Create the first client</Link>} /> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <Table>
            <THead><TR><TH>Client</TH><TH>Status</TH><TH className="text-right">Users</TH><TH className="text-right">Docs</TH><TH className="text-right">Leads 30d</TH><TH className="text-right">Bookings 30d</TH><TH>Last data</TH></TR></THead>
            <TBody>{clients.map((c) => (
              <TR key={c.id}><TD><Link href={`/admin/clients/${c.id}`} className="font-medium hover:text-brand-hover">{c.name}</Link><div className="text-xs text-subtle">{c.planName}</div></TD>
                <TD><Badge variant={variant[c.status]} dot>{c.status}</Badge></TD><TD className="text-right tabular-nums">{c.users}</TD><TD className="text-right tabular-nums">{c.docs}</TD>
                <TD className="text-right tabular-nums">{c.leads30}</TD><TD className="text-right tabular-nums">{c.bookings30}</TD><TD className="text-muted">{c.lastResult ? formatDate(c.lastResult) : "—"}</TD></TR>
            ))}</TBody>
          </Table>
        </div>
      )}
      <Card className="mt-6"><CardHeader><CardTitle>Recent activity</CardTitle></CardHeader><CardContent>
        {activity.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : <ul className="grid gap-2 text-sm">{activity.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2"><span><code className="text-xs text-brand-hover">{a.action}</code> <span className="text-muted">{a.clientName ?? ""} {a.actorEmail ? `· ${a.actorEmail}` : ""}</span></span><span className="text-xs text-subtle">{relativeTime(a.createdAt)}</span></li>))}</ul>}
      </CardContent></Card>
    </>
  );
}
