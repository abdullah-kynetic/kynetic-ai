import { Download } from "lucide-react";
import { loadDetail } from "../load";
import { deleteItem } from "@/lib/actions/admin";
import { ActionButton } from "@/components/forms/action-form";
import { UploadBox } from "@/components/forms/upload";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatBytes, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DocumentsTab({ params }: PageProps<"/admin/clients/[id]/documents">) {
  const { id } = await params;
  const { documents } = await loadDetail(id);
  return (
    <div className="grid gap-5">
      <UploadBox clientId={id} />
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <Table>
          <THead><TR><TH>Name</TH><TH>Category</TH><TH>Uploaded by</TH><TH>Date</TH><TH className="text-right">Size</TH><TH /></TR></THead>
          <TBody>{documents.length === 0 ? <TR><TD colSpan={6} className="text-muted">No documents.</TD></TR> : documents.map((d) => (
            <TR key={d.id}><TD className="font-medium">{d.name}</TD><TD><Badge>{d.category}</Badge></TD><TD className="text-muted">{d.uploadedByRole === "admin" ? "Kynetic" : d.uploaderEmail ?? "client"}</TD><TD className="text-muted">{formatDate(d.createdAt)}</TD><TD className="text-right tabular-nums text-muted">{formatBytes(d.size)}</TD>
              <TD><div className="flex justify-end gap-1"><a href={d.url} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}><Download />Download</a>
                <ActionButton action={deleteItem} hidden={{ clientId: id, id: d.id, kind: "document" }} label="Delete" variant="destructive" confirm="Delete this document permanently?" /></div></TD></TR>
          ))}</TBody>
        </Table>
      </div>
    </div>
  );
}
