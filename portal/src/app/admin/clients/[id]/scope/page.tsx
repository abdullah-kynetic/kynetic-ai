import { loadDetail } from "../load";
import { saveScopeItem } from "@/lib/actions/admin";
import { ActionForm } from "@/components/forms/action-form";
import { AddPanel, EditableRow } from "@/components/forms/editable-list";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type S = { id?: string; title?: string; description?: string | null; status?: "planned" | "in_progress" | "done"; sort?: number };
function ScopeForm({ clientId, s }: { clientId: string; s?: S }) {
  return (
    <ActionForm action={saveScopeItem} hidden={{ clientId, id: s?.id ?? "" }} submit="Save item" resetOnSuccess={!s}>
      <Field label="Title" htmlFor={`t${s?.id}`}><Input id={`t${s?.id}`} name="title" defaultValue={s?.title} required /></Field>
      <Field label="Description" htmlFor={`d${s?.id}`}><Textarea id={`d${s?.id}`} name="description" rows={2} defaultValue={s?.description ?? ""} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor={`s${s?.id}`}><Select id={`s${s?.id}`} name="status" defaultValue={s?.status ?? "planned"}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="done">Delivered</option></Select></Field>
        <Field label="Order" htmlFor={`o${s?.id}`}><Input id={`o${s?.id}`} name="sort" type="number" min={0} defaultValue={s?.sort ?? 0} /></Field>
      </div>
    </ActionForm>
  );
}

export default async function ScopeTab({ params }: PageProps<"/admin/clients/[id]/scope">) {
  const { id } = await params;
  const { scope } = await loadDetail(id);
  return (
    <>
      <AddPanel label="Add scope item"><ScopeForm clientId={id} /></AddPanel>
      <ul className="grid gap-2">{scope.map((s) => (
        <EditableRow key={s.id} clientId={id} id={s.id} kind="scope" edit={<ScopeForm clientId={id} s={s} />}
          summary={<><div className="flex items-center gap-2 font-medium">{s.title}<Badge variant={s.status === "done" ? "success" : s.status === "in_progress" ? "brand" : "default"}>{s.status.replace("_", " ")}</Badge></div><div className="text-sm text-muted">{s.description}</div></>} />
      ))}</ul>
    </>
  );
}
