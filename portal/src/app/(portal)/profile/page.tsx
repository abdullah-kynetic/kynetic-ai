import { requireClient } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/client";
import { PageHeader } from "@/components/shell/page";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Business profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const s = await requireClient();
  const p = await getProfile(s);
  const rows: [string, string | null | undefined][] = [
    ["Legal name", p?.legalName], ["Industry", p?.industry], ["Website", p?.website], ["Phone", p?.phone],
    ["Address", p?.address], ["Service area", p?.serviceArea], ["Business hours", p?.hours], ["Notes", p?.notes],
  ];
  return (
    <>
      <PageHeader title="Business profile" description="What Kynetic has on file for your business. Tell us if anything needs to change." />
      <Card><CardContent className="pt-5"><dl className="grid gap-5 sm:grid-cols-2">
        {rows.map(([k, v]) => (<div key={k} className={k === "Notes" ? "sm:col-span-2" : ""}><dt className="text-xs uppercase tracking-wide text-subtle">{k}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{v || "—"}</dd></div>))}
      </dl></CardContent></Card>
    </>
  );
}
