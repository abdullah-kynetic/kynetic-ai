"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "./action-form";
import { deleteItem } from "@/lib/actions/admin";

/** A row with a summary, an inline edit panel (the `edit` slot) and a delete button. */
export function EditableRow({ summary, edit, clientId, id, kind }: { summary: React.ReactNode; edit: React.ReactNode; clientId: string; id: string; kind: "contact" | "scope" | "milestone" | "document" }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{summary}</div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}><Pencil />{open ? "Close" : "Edit"}</Button>
          <ActionButton action={deleteItem} hidden={{ clientId, id, kind }} label="Delete" variant="destructive" confirm="Delete this item? This cannot be undone." />
        </div>
      </div>
      {open ? <div className="mt-4 border-t border-border pt-4">{edit}</div> : null}
    </li>
  );
}

export function AddPanel({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <Button variant={open ? "ghost" : "default"} onClick={() => setOpen((o) => !o)}><Plus />{open ? "Cancel" : label}</Button>
      {open ? <div className="mt-3 rounded-xl border border-border bg-surface p-4">{children}</div> : null}
    </div>
  );
}
