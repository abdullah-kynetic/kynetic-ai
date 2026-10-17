import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { getClient, getResults, listMilestones, listScope } from "@/lib/data/client";
import { PageHeader, Stat } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MinutesBar } from "@/components/portal/results-view";
import { ResultsCharts } from "@/components/charts/results-charts";
import { formatDate, formatNumber } from "@/lib/utils";
import { notFound } from "next/navigation";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const statusVariant = { onboarding: "info", active: "success", paused: "warning" } as const;

export default async function Overview() {
  const s = await requireClient();
  const [client, results, milestones, scope] = await Promise.all([getClient(s), getResults(s), listMilestones(s), listScope(s)]);
  if (!client || !results) notFound();
  const next = milestones.find((m) => m.status !== "done");
  const done = milestones.filter((m) => m.status === "done").length;
  const scopeDone = scope.filter((i) => i.status === "done").length;
  const t = results.totals;
  return (
    <>
      <PageHeader title={client.name} description={`${client.planName} · your project at a glance`} badge={<Badge variant={statusVariant[client.status]} dot>{client.status}</Badge>} />
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Avg speed to lead" value={t.avgSpeedToLeadSec === null ? "—" : `${formatNumber(t.avgSpeedToLeadSec, 1)}s`} hint="Last 30 days" />
          <Stat label="Calls" value={formatNumber(t.calls)} hint="Last 30 days" />
          <Stat label="Bookings" value={formatNumber(t.bookings)} hint="Last 30 days" />
          <Stat label="Scope delivered" value={`${scopeDone}/${scope.length}`} hint="Plan 1 items" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Next milestone</CardTitle></CardHeader>
            <CardContent>
              {next ? (<div><div className="flex items-center gap-2"><span className="font-medium">{next.title}</span><Badge variant={next.status === "in_progress" ? "brand" : "default"}>{next.status.replace("_", " ")}</Badge></div>
                <p className="mt-1 text-sm text-muted">{next.description}</p><p className="mt-2 text-sm text-subtle">Due {formatDate(next.dueDate)}</p></div>)
                : <p className="text-sm text-muted">All milestones complete. 🎉</p>}
              <p className="mt-3 text-xs text-subtle">{done} of {milestones.length} milestones done</p>
              <Link href="/timeline" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-hover hover:underline">View timeline <ArrowRight className="size-3.5" /></Link>
            </CardContent>
          </Card>
          <MinutesBar month={results.month} />
        </div>
        <ResultsCharts rows={results.rows.slice(-14)} />
      </div>
    </>
  );
}
