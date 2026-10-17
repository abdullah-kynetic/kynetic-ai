import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDate } from "@/lib/utils";
import { Milestone } from "lucide-react";

type M = { id: string; phase: "kickoff" | "build" | "testing" | "go_live"; title: string; description: string | null; dueDate: string | null; status: "upcoming" | "in_progress" | "done" };
const phaseLabel = { kickoff: "Kickoff", build: "Build", testing: "Testing", go_live: "Go-live" } as const;

export function TimelineView({ milestones }: { milestones: M[] }) {
  if (!milestones.length) return <EmptyState icon={Milestone} title="Timeline not set yet" />;
  return (
    <ol className="relative grid gap-0">
      {milestones.map((m, i) => (
        <li key={m.id} className="relative flex gap-4 pb-8 last:pb-0">
          {i < milestones.length - 1 ? <span className={cn("absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px", m.status === "done" ? "bg-success/50" : "bg-border-strong")} /> : null}
          <span className={cn("z-10 grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
            m.status === "done" ? "border-success bg-success/15 text-success" : m.status === "in_progress" ? "border-brand bg-brand-tint text-[#e879f9] shadow-[0_0_0_4px_rgb(183_13_198/0.15)]" : "border-border-strong bg-surface text-subtle")}>
            {m.status === "done" ? <Check className="size-4" /> : i + 1}
          </span>
          <div className="min-w-0 flex-1 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2"><Badge>{phaseLabel[m.phase]}</Badge><span className="font-medium">{m.title}</span>
              <Badge variant={m.status === "done" ? "success" : m.status === "in_progress" ? "brand" : "default"} dot>{m.status.replace("_", " ")}</Badge></div>
            {m.description ? <p className="mt-1.5 text-sm text-muted">{m.description}</p> : null}
            <p className="mt-2 text-xs text-subtle">{m.dueDate ? `Target: ${formatDate(m.dueDate)}` : "No date set"}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
