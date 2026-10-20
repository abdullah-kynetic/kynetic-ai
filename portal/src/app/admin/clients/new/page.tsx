import { createClient } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { ActionForm } from "@/components/forms/action-form";
import { PageHeader } from "@/components/shell/page";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const metadata = { title: "New client" };

export default async function NewClient() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="New client" description="Creates the client with a default kickoff → go-live timeline." />
      <Card className="max-w-xl"><CardContent className="pt-5">
        <ActionForm action={createClient} submit="Create client" pendingLabel="Creating…">
          <Field label="Business name" htmlFor="name"><Input id="name" name="name" required minLength={2} maxLength={120} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue="onboarding"><option value="onboarding">Onboarding</option><option value="active">Active</option><option value="paused">Paused</option></Select></Field>
            <Field label="Plan" htmlFor="planName"><Input id="planName" name="planName" defaultValue="Plan 1" /></Field>
            <Field label="Included minutes / month" htmlFor="includedMinutes"><Input id="includedMinutes" name="includedMinutes" type="number" min={0} defaultValue={1200} /></Field>
            <Field label="Twenty company id (optional)" htmlFor="twentyCompanyId"><Input id="twentyCompanyId" name="twentyCompanyId" /></Field>
          </div>
        </ActionForm>
      </CardContent></Card>
    </>
  );
}
