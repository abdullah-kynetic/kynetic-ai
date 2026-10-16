import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/session";
import { getResults } from "@/lib/data/client";
import { PageHeader } from "@/components/shell/page";
import { ResultsView } from "@/components/portal/results-view";

export const metadata = { title: "Results" };
export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const s = await requireClient();
  const data = await getResults(s, 30);
  if (!data) notFound();
  return (<><PageHeader title="Results" description="Speed-to-lead, calls and bookings from your AI agents. Last 30 days." /><ResultsView data={data} /></>);
}
