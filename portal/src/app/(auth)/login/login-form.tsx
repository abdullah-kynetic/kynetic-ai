"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { loginWithPassword } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginWithPassword, undefined);
  // Controlled so the values survive the form reset React does after each action (step two re-submits them as hidden fields).
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // "Back" hides step two for the current result; the next result from the server is a new object, so step two returns on its own.
  const [dismissed, setDismissed] = useState<unknown>(null);
  const mfaCode = state?.code === "mfa_required" || state?.code === "invalid_totp";
  const mfa = mfaCode && dismissed !== state;
  const error = state?.error && state.code !== "mfa_required" ? state.error : null;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      {mfa ? (
        <>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="password" value={password} />
          <p className="text-sm text-muted">Signing in as <span className="text-foreground">{email}</span></p>
          <Field label="Authenticator or recovery code" htmlFor="totp" hint="The 6-digit code from your app, or one of your one-time recovery codes.">
            <Input id="totp" name="totp" autoComplete="one-time-code" inputMode="text" maxLength={16} required autoFocus />
          </Field>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="remember" className="h-4 w-4" />
            Remember this device for 30 days
          </label>
        </>
      ) : (
        <>
          <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        </>
      )}
      {error ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-text">{error}</p> : null}
      {mfa && state?.code === "mfa_required" ? <p className="text-sm text-muted">{state.error}</p> : null}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Signing in…" : mfa ? "Verify and sign in" : "Sign in"}</Button>
      {mfa ? (
        <div className="text-sm"><button type="button" onClick={() => { setDismissed(state); setPassword(""); }} className="text-muted hover:text-foreground">← Back</button></div>
      ) : (
        <div className="flex justify-between text-sm"><Link href="/login/magic" className="text-muted hover:text-foreground">Email me a sign-in link</Link><Link href="/forgot" className="text-muted hover:text-foreground">Forgot password?</Link></div>
      )}
    </form>
  );
}
