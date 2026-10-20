import { loadDetail } from "../load";
import { saveContact } from "@/lib/actions/admin";
import { ActionForm } from "@/components/forms/action-form";
import { AddPanel, EditableRow } from "@/components/forms/editable-list";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type C = { id?: string; name?: string; title?: string | null; email?: string | null; phone?: string | null; isPrimary?: boolean };
function ContactForm({ clientId, c }: { clientId: string; c?: C }) {
  return (
    <ActionForm action={saveContact} hidden={{ clientId, id: c?.id ?? "" }} submit="Save contact" resetOnSuccess={!c}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`n${c?.id}`}><Input id={`n${c?.id}`} name="name" defaultValue={c?.name} required /></Field>
        <Field label="Title" htmlFor={`t${c?.id}`}><Input id={`t${c?.id}`} name="title" defaultValue={c?.title ?? ""} /></Field>
        <Field label="Email" htmlFor={`e${c?.id}`}><Input id={`e${c?.id}`} name="email" type="email" defaultValue={c?.email ?? ""} /></Field>
        <Field label="Phone" htmlFor={`p${c?.id}`}><Input id={`p${c?.id}`} name="phone" defaultValue={c?.phone ?? ""} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPrimary" defaultChecked={c?.isPrimary} className="size-4 accent-[#b70dc6]" />Primary contact</label>
    </ActionForm>
  );
}

export default async function ContactsTab({ params }: PageProps<"/admin/clients/[id]/contacts">) {
  const { id } = await params;
  const { contacts } = await loadDetail(id);
  return (
    <>
      <AddPanel label="Add contact"><ContactForm clientId={id} /></AddPanel>
      <ul className="grid gap-2">{contacts.map((c) => (
        <EditableRow key={c.id} clientId={id} id={c.id} kind="contact" edit={<ContactForm clientId={id} c={c} />}
          summary={<><div className="flex items-center gap-2 font-medium">{c.name}{c.isPrimary ? <Badge variant="brand">Primary</Badge> : null}</div><div className="text-sm text-muted">{[c.title, c.email, c.phone].filter(Boolean).join(" · ")}</div></>} />
      ))}</ul>
    </>
  );
}
