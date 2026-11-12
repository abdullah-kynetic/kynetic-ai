"use client";
import { loginWithMagic } from "@/lib/auth/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function MagicForm({ token, needsTotp }: { token: string; needsTotp: boolean }) {
  return (
    <ActionForm action={loginWithMagic} submit="Sign in" pendingLabel="Signing in…" hidden={{ token }}>
      {needsTotp ? <Field label="Email verification code" htmlFor="totp"><Input id="totp" name="totp" autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required autoFocus /></Field> : null}
    </ActionForm>
  );
}
