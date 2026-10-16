"use client";
import Link from "next/link";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type A = Parameters<typeof ActionForm>[0]["action"];

export function SetPasswordForm({ action, token, withName }: { action: A; token: string; withName?: boolean }) {
  const [done, setDone] = useState(false);
  if (done) return (<div className="grid gap-3"><p className="text-sm text-green-300">All set.</p><Link href="/login" className="inline-flex h-11 items-center justify-center rounded-lg bg-brand font-semibold text-white hover:bg-brand-hover">Continue to sign in</Link></div>);
  return (
    <ActionForm action={action} submit="Save password" hidden={{ token }} onResult={(s) => s.ok && setDone(true)}>
      {withName ? <Field label="Your name" htmlFor="name"><Input id="name" name="name" autoComplete="name" maxLength={120} /></Field> : null}
      <Field label="New password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required /></Field>
      <Field label="Confirm password" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required /></Field>
    </ActionForm>
  );
}
