import { loadDetail } from "../load";
import { saveMilestone } from "@/lib/actions/admin";
import { ActionForm } from "@/components/forms/action-form";
import { AddPanel, EditableRow } from "@/components/forms/editable-list";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type M = { id?: string; phase?: "kickoff" | "build" | "testing" | "go_live"; title?: string; description?: string | null; dueDate?: string | null; status?: "upcoming" | "in_progress" | "done"; sort?: number };
function MilestoneForm({ clientId, m }: { clientId: string; m?: M }) {
  return (
    <ActionForm action={saveMilestone} hidden={{ clientId, id: m?.id ?? "" }} submit="Save milestone" resetOnSuccess={!m}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phase" htmlFor={`p${m?.id}`}><Select id={`p${m?.id}`} name="phase" defaultValue={m?.phase ?? "kickoff"}><option value="kickoff">Kickoff</option><option value="build">Build</option><option value="testing">Testing</option><option value="go_live">Go-live</option></Select></Field>
        <Field label="Status" htmlFor={`s${m?.id}`}><Select id={`s${m?.id}`} name="status" defaultValue={m?.status ?? "upcoming"}><option value="upcoming">Upcoming</option><option value="in_progress">In progress</option><option value="done">Done</option></Select></Field>
        <Field label="Title" htmlFor={`t${m?.id}`}><Input id={`t${m?.id}`} name="title" defaultValue={m?.title} required /></Field>
        <Field label="Target date" htmlFor={`d${m?.id}`}><Input id={`d${m?.id}`} name="dueDate" type="date" defaultValue={m?.dueDate ?? ""} /></Field>
        <Field label="Order" htmlFor={`o${m?.id}`}><Input id={`o${m?.id}`} name="sort" type="number" min={0} defaultValue={m?.sort ?? 0} /></Field>
      </div>
      <Field label="Description" htmlFor={`x${m?.id}`}><Textarea id={`x${m?.id}`} name="description" rows={2} defaultValue={m?.description ?? ""} /></Field>
    </ActionForm>
  );
}

export default async function TimelineTab({ params }: PageProps<"/admin/clients/[id]/timeline">) {
  const { id } = await params;
  const { milestones } = await loadDetail(id);
  return (
    <>
      <AddPanel label="Add milestone"><MilestoneForm clientId={id} /></AddPanel>
      <ul className="grid gap-2">{milestones.map((m) => (
        <EditableRow key={m.id} clientId={id} id={m.id} kind="milestone" edit={<MilestoneForm clientId={id} m={m} />}
          summary={<><div className="flex flex-wrap items-center gap-2 font-medium"><Badge>{m.phase.replace("_", "-")}</Badge>{m.title}<Badge variant={m.status === "done" ? "success" : m.status === "in_progress" ? "brand" : "default"}>{m.status.replace("_", " ")}</Badge></div><div className="text-sm text-muted">{m.dueDate ? `Target ${formatDate(m.dueDate)}` : "No date"}{m.description ? ` · ${m.description}` : ""}</div></>} />
      ))}</ul>
    </>
  );
}
