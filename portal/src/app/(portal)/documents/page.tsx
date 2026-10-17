import { Download, FileText } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { listDocuments } from "@/lib/data/client";
import { PageHeader } from "@/components/shell/page";
import { UploadBox } from "@/components/forms/upload";
import { DocumentsTable } from "@/components/portal/documents-table";

export const metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const s = await requireClient();
  const docs = await listDocuments(s);
  void Download; void FileText;
  return (
    <>
      <PageHeader title="Documents" description="Contracts, notes and files shared between you and Kynetic." />
      <div className="grid gap-5"><UploadBox /><DocumentsTable docs={docs} /></div>
    </>
  );
}
