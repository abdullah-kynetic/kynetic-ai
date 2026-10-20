"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RecoveryCodes } from "@/components/forms/recovery-codes";
import { confirmTotpEnrolment, startTotpEnrolment } from "@/lib/auth/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function MfaSetup() {
  const [data, setData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const router = useRouter();
  if (codes) return <RecoveryCodes codes={codes} doneLabel="I've saved them, continue" onDone={() => { router.push("/admin"); router.refresh(); }} />;
  if (!data) return <Button disabled={busy} onClick={async () => { setBusy(true); setData(await startTotpEnrolment()); setBusy(false); }}>{busy ? "Generating…" : "Generate QR code"}</Button>;
  return (
    <div className="grid gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.qrDataUrl} alt="TOTP QR code" width={220} height={220} className="rounded-lg bg-white p-2" />
      <p className="text-xs text-muted">Can&apos;t scan? Enter this key manually: <code className="break-all font-mono text-foreground">{data.secret}</code></p>
      <ActionForm action={confirmTotpEnrolment} submit="Enable two-factor" onResult={(s) => s.codes && setCodes(s.codes)}>
        <Field label="6-digit code" htmlFor="code"><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus /></Field>
      </ActionForm>
    </div>
  );
}
