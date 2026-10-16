import { loadDetail } from "./load";
import { updateClient } from "@/lib/actions/admin";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

export default async function ClientSettings({ params }: PageProps<"/admin/clients/[id]">) {
  const { id } = await params;
  const { client } = await loadDetail(id);
  return (
    <Card className="max-w-xl"><CardContent className="pt-5">
      <ActionForm action={updateClient} hidden={{ clientId: id }} submit="Save client">
        <Field label="Business name" htmlFor="name"><Input id="name" name="name" defaultValue={client.name} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue={client.status}><option value="onboarding">Onboarding</option><option value="active">Active</option><option value="paused">Paused</option></Select></Field>
          <Field label="Plan" htmlFor="planName"><Input id="planName" name="planName" defaultValue={client.planName} /></Field>
          <Field label="Included minutes / month" htmlFor="includedMinutes"><Input id="includedMinutes" name="includedMinutes" type="number" min={0} defaultValue={client.includedMinutes} /></Field>
          <Field label="Twenty company id" htmlFor="twentyCompanyId"><Input id="twentyCompanyId" name="twentyCompanyId" defaultValue={client.twentyCompanyId ?? ""} /></Field>
        </div>
      </ActionForm>
    </CardContent></Card>
  );
}
