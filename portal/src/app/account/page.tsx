import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { changePassword, logoutEverywhere } from "@/lib/auth/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { remainingRecoveryCodes } from "@/lib/auth/recovery";
import { RecoveryPanel } from "./recovery-panel";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const s = await requireUser();
  const remaining = s.role === "admin" && s.totpEnabled ? await remainingRecoveryCodes(s.userId) : null;
  return (
    <div className="mx-auto grid max-w-lg gap-5 px-4 py-10">
      <div className="flex items-center justify-between"><Logo /><Link href={s.role === "admin" ? "/admin" : "/"} className="text-sm text-muted hover:text-foreground">← Back</Link></div>
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <p className="-mt-3 text-sm text-muted">{s.email}</p>
      <Card><CardHeader><CardTitle>Change password</CardTitle></CardHeader><CardContent>
        <ActionForm action={changePassword} submit="Update password">
          <Field label="Current password" htmlFor="current"><Input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
          <Field label="New password" htmlFor="password" hint="At least 12 characters. You'll be signed out everywhere."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required /></Field>
          <Field label="Confirm new password" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required /></Field>
        </ActionForm>
      </CardContent></Card>
      {remaining !== null ? <Card><CardHeader><CardTitle>Recovery codes</CardTitle></CardHeader><CardContent><RecoveryPanel remaining={remaining} /></CardContent></Card> : null}
      <Card><CardHeader><CardTitle>Sessions</CardTitle></CardHeader><CardContent>
        <form action={logoutEverywhere}><Button type="submit" variant="outline">Sign out of all devices</Button></form>
      </CardContent></Card>
    </div>
  );
}
