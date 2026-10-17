import { requireClient } from "@/lib/auth/session";
import { listMilestones } from "@/lib/data/client";
import { PageHeader } from "@/components/shell/page";
import { TimelineView } from "@/components/portal/timeline-view";

export const metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const s = await requireClient();
  const milestones = await listMilestones(s);
  return (<><PageHeader title="Timeline" description="Kickoff → build → testing → go-live." /><TimelineView milestones={milestones} /></>);
}
