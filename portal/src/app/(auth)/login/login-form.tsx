"use client";
import { useActionState } from "react";
import Link from "next/link";
import { loginWithPassword } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginWithPassword, undefined);
  const mfa = state?.code === "mfa_required" || state?.code === "invalid_totp";
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" required autoFocus /></Field>
      <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      {mfa ? <Field label="Authenticator or recovery code" htmlFor="totp" hint="The 6-digit code from your app, or one of your one-time recovery codes."><Input id="totp" name="totp" autoComplete="one-time-code" maxLength={16} autoFocus /></Field> : null}
      {state?.error && state.code !== "mfa_required" ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-red-300">{state.error}</p> : null}
      {state?.code === "mfa_required" ? <p className="text-sm text-muted">{state.error}</p> : null}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      <div className="flex justify-between text-sm"><Link href="/login/magic" className="text-muted hover:text-foreground">Email me a sign-in link</Link><Link href="/forgot" className="text-muted hover:text-foreground">Forgot password?</Link></div>
    </form>
  );
}
