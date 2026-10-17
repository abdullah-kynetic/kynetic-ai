import { loadDetail } from "../load";
import { saveProfile } from "@/lib/actions/admin";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

export default async function ProfileTab({ params }: PageProps<"/admin/clients/[id]/profile">) {
  const { id } = await params;
  const { profile: p } = await loadDetail(id);
  const f = (name: string, label: string, v?: string | null) => <Field label={label} htmlFor={name}><Input id={name} name={name} defaultValue={v ?? ""} /></Field>;
  return (
    <Card className="max-w-2xl"><CardContent className="pt-5">
      <ActionForm action={saveProfile} hidden={{ clientId: id }} submit="Save profile">
        <div className="grid gap-4 sm:grid-cols-2">
          {f("legalName", "Legal name", p?.legalName)}{f("industry", "Industry", p?.industry)}{f("website", "Website", p?.website)}{f("phone", "Phone", p?.phone)}
          {f("address", "Address", p?.address)}{f("serviceArea", "Service area", p?.serviceArea)}{f("hours", "Business hours", p?.hours)}
        </div>
        <Field label="Notes (visible to client)" htmlFor="notes"><Textarea id="notes" name="notes" rows={4} defaultValue={p?.notes ?? ""} /></Field>
      </ActionForm>
    </CardContent></Card>
  );
}
