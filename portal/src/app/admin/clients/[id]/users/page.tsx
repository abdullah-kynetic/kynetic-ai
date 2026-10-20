import { loadDetail } from "../load";
import { inviteUser } from "@/lib/actions/admin";
import { ActionForm } from "@/components/forms/action-form";
import { UserActions } from "./user-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UsersTab({ params }: PageProps<"/admin/clients/[id]/users">) {
  const { id } = await params;
  const { users } = await loadDetail(id);
  return (
    <div className="grid gap-5">
      <Card className="max-w-xl"><CardHeader><CardTitle>Invite a user</CardTitle></CardHeader><CardContent>
        <ActionForm action={inviteUser} hidden={{ clientId: id }} submit="Send invite" pendingLabel="Inviting…" resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required /></Field><Field label="Name (optional)" htmlFor="name"><Input id="name" name="name" /></Field></div>
        </ActionForm>
      </CardContent></Card>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <Table>
          <THead><TR><TH>User</TH><TH>Status</TH><TH>Last sign-in</TH><TH /></TR></THead>
          <TBody>{users.length === 0 ? <TR><TD colSpan={4} className="text-muted">No users yet.</TD></TR> : users.map((u) => (
            <TR key={u.id}><TD><div className="font-medium">{u.name || u.email}</div>{u.name ? <div className="text-xs text-subtle">{u.email}</div> : null}</TD>
              <TD>{u.disabledAt ? <Badge variant="danger" dot>Disabled</Badge> : u.hasPassword ? <Badge variant="success" dot>Active</Badge> : <><Badge variant="warning" dot>Invited</Badge><div className="mt-1 text-xs text-subtle">{u.inviteExpiresAt ? `Link expires ${formatDateTime(u.inviteExpiresAt)}` : "Link expired"}</div></>}</TD>
              <TD className="text-muted">{u.lastLoginAt ? relativeTime(u.lastLoginAt) : "never"}</TD>
              <TD className="text-right"><UserActions clientId={id} u={{ id: u.id, email: u.email, hasPassword: u.hasPassword, disabled: !!u.disabledAt }} /></TD></TR>
          ))}</TBody>
        </Table>
      </div>
    </div>
  );
}
