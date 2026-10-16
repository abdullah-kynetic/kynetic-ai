import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Enter your email and we&apos;ll send a reset link.</p>
      <ActionForm action={requestPasswordReset} submit="Send reset link" pendingLabel="Sending…">
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required autoFocus /></Field>
      </ActionForm>
      <p className="mt-5 text-sm"><Link href="/login" className="text-muted hover:text-foreground">← Back to sign in</Link></p>
    </>
  );
}
