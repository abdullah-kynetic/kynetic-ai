import { loadDetail } from "../load";
import { createIngestKey, revokeIngestKey } from "@/lib/actions/admin";
import { ActionButton } from "@/components/forms/action-form";
import { KeyCreator } from "./key-creator";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function KeysTab({ params }: PageProps<"/admin/clients/[id]/keys">) {
  const { id } = await params;
  const { keys } = await loadDetail(id);
  return (
    <div className="grid gap-5">
      <KeyCreator clientId={id} action={createIngestKey} />
      <p className="text-sm text-muted">n8n posts daily results with <code className="text-xs">Authorization: Bearer &lt;key&gt;</code> to <code className="text-xs">/api/ingest/results</code>. See N8N.md.</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <Table>
          <THead><TR><TH>Label</TH><TH>Key</TH><TH>Created</TH><TH>Last used</TH><TH /></TR></THead>
          <TBody>{keys.length === 0 ? <TR><TD colSpan={5} className="text-muted">No keys yet.</TD></TR> : keys.map((k) => (
            <TR key={k.id}><TD className="font-medium">{k.label}</TD><TD><code className="text-xs">kp_{k.prefix}_…</code> {k.revokedAt ? <Badge variant="danger">revoked</Badge> : <Badge variant="success">active</Badge>}</TD>
              <TD className="text-muted">{formatDate(k.createdAt)}</TD><TD className="text-muted">{k.lastUsedAt ? relativeTime(k.lastUsedAt) : "never"}</TD>
              <TD className="text-right">{k.revokedAt ? null : <ActionButton action={revokeIngestKey} hidden={{ clientId: id, keyId: k.id }} label="Revoke" variant="destructive" confirm="Revoke this key? n8n will stop working until updated." />}</TD></TR>
          ))}</TBody>
        </Table>
      </div>
    </div>
  );
}
