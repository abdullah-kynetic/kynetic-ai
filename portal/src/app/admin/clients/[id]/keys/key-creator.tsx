"use client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { CopyField } from "@/components/forms/copy-secret";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type A = Parameters<typeof ActionForm>[0]["action"];

export function KeyCreator({ clientId, action }: { clientId: string; action: A }) {
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <>
      <ActionForm action={action} hidden={{ clientId }} submit="Generate key" className="max-w-md" onResult={(s) => s.secret && setSecret(s.secret)}>
        <Field label="Label" htmlFor="label"><Input id="label" name="label" defaultValue="n8n" maxLength={60} /></Field>
      </ActionForm>
      <Dialog open={!!secret} onOpenChange={() => {}} dismissible={false} title="Copy your ingest key" description="This is the only time the full key is shown. Store it in n8n credentials now.">
        {secret ? <div className="grid gap-4"><CopyField value={secret} /><Button onClick={() => setSecret(null)}>I&apos;ve saved it</Button></div> : null}
      </Dialog>
    </>
  );
}
