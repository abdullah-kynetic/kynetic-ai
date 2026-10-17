import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatBytes, formatDate } from "@/lib/utils";

type D = { id: string; name: string; category: string; size: number; createdAt: Date; uploader: string; url: string };

export function DocumentsTable({ docs }: { docs: D[] }) {
  if (!docs.length) return <EmptyState icon={FileText} title="No documents yet" description="Files you or Kynetic upload will show up here." />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <Table>
        <THead><TR><TH>Name</TH><TH>Category</TH><TH>Added by</TH><TH>Date</TH><TH className="text-right">Size</TH><TH /></TR></THead>
        <TBody>{docs.map((d) => (
          <TR key={d.id}><TD className="font-medium">{d.name}</TD><TD><Badge>{d.category}</Badge></TD><TD className="text-muted">{d.uploader}</TD><TD className="text-muted">{formatDate(d.createdAt)}</TD><TD className="text-right tabular-nums text-muted">{formatBytes(d.size)}</TD>
            <TD className="text-right"><a href={d.url} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}><Download />Download</a></TD></TR>
        ))}</TBody>
      </Table>
    </div>
  );
}
