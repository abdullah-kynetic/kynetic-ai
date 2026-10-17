import { CheckCircle2, Circle, CircleDot, ListChecks } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { listScope } from "@/lib/data/client";
import { PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";

export const metadata = { title: "Plan 1 scope" };
export const dynamic = "force-dynamic";

const icon = { done: <CheckCircle2 className="size-5 text-success" />, in_progress: <CircleDot className="size-5 text-brand-hover" />, planned: <Circle className="size-5 text-subtle" /> };
const label = { done: "Delivered", in_progress: "In progress", planned: "Planned" } as const;

export default async function ScopePage() {
  const s = await requireClient();
  const items = await listScope(s);
  const done = items.filter((i) => i.status === "done").length;
  return (
    <>
      <PageHeader title="Plan 1 scope" description="Everything included in your Plan 1 build, and where each piece stands." />
      {items.length === 0 ? <EmptyState icon={ListChecks} title="Scope not set yet" /> : (
        <>
          <div className="mb-5 rounded-xl border border-border bg-surface p-4"><div className="mb-2 flex justify-between text-sm"><span className="text-muted">Delivered</span><span className="tabular-nums">{done} / {items.length}</span></div><Progress value={(done / items.length) * 100} /></div>
          <ul className="grid gap-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
                {icon[i.status]}
                <div className="min-w-0 flex-1"><div className="font-medium">{i.title}</div>{i.description ? <p className="mt-0.5 text-sm text-muted">{i.description}</p> : null}</div>
                <Badge variant={i.status === "done" ? "success" : i.status === "in_progress" ? "brand" : "default"}>{label[i.status]}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
