"use client";
import { useState } from "react";
import { cancelInvite, changeUserEmail, inviteUser, removeUser, sendResetLink, setUserDisabled } from "@/lib/actions/admin";
import { ActionButton, ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type U = { id: string; email: string; hasPassword: boolean; disabled: boolean };

/** Per-user admin actions. What shows depends on the user's state (invited, active, disabled). */
export function UserActions({ clientId, u }: { clientId: string; u: U }) {
  const [editing, setEditing] = useState(false);
  const base = { clientId, userId: u.id };
  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        {!u.hasPassword ? (
          <>
            <ActionForm action={inviteUser} hidden={{ clientId, email: u.email }} submit="Resend invite" submitVariant="ghost" />
            <ActionButton action={cancelInvite} hidden={base} label="Cancel invite" variant="outline" confirm="Cancel this invite? The link stops working and the pending user is removed." />
          </>
        ) : (
          <>
            <ActionButton action={sendResetLink} hidden={base} label="Send reset link" variant="ghost" />
            <ActionButton action={setUserDisabled} hidden={{ ...base, disable: u.disabled ? "false" : "true" }} label={u.disabled ? "Enable" : "Disable"} variant="outline" confirm={u.disabled ? undefined : "Disable this user and sign them out?"} />
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Change email"}</Button>
        <ActionButton action={removeUser} hidden={base} label="Remove" variant="destructive" confirm="Permanently remove this user? This cannot be undone." />
      </div>
      {editing ? (
        <ActionForm action={changeUserEmail} hidden={base} submit="Change" className="w-full max-w-xs !grid-cols-[1fr_auto] items-center gap-2" onResult={(s) => s.ok && setEditing(false)}>
          <Input name="email" type="email" defaultValue={u.email} required aria-label="New email" />
        </ActionForm>
      ) : null}
    </div>
  );
}
