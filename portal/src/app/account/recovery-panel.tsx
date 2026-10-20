"use client";
import { useState } from "react";
import { regenerateRecoveryCodes } from "@/lib/auth/actions";
import { ActionForm } from "@/components/forms/action-form";
import { RecoveryCodes } from "@/components/forms/recovery-codes";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function RecoveryPanel({ remaining }: { remaining: number }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  if (codes) return <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">{remaining} unused recovery code{remaining === 1 ? "" : "s"}. Generating a new set replaces the old ones.</p>
      <ActionForm action={regenerateRecoveryCodes} submit="Generate new codes" onResult={(s) => s.codes && setCodes(s.codes)}>
        <Field label="Confirm your password" htmlFor="rc-password"><Input id="rc-password" name="password" type="password" autoComplete="current-password" required /></Field>
      </ActionForm>
    </div>
  );
}
