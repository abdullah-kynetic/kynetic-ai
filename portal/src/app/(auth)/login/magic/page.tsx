import Link from "next/link";
import { requestMagicLink } from "@/lib/auth/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Email sign-in link" };

export default function MagicRequestPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Email me a link</h1>
      <p className="mb-5 mt-1 text-sm text-muted">We&apos;ll send a one-time sign-in link, valid for 15 minutes.</p>
      <ActionForm action={requestMagicLink} submit="Send link" pendingLabel="Sending…">
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required autoFocus /></Field>
      </ActionForm>
      <p className="mt-5 text-sm"><Link href="/login" className="text-muted hover:text-foreground">← Back to sign in</Link></p>
    </>
  );
}
