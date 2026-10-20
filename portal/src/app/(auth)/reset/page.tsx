import Link from "next/link";
import { resetPassword } from "@/lib/auth/actions";
import { peekToken } from "@/lib/auth/tokens";
import { SetPasswordForm } from "@/components/forms/set-password";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: PageProps<"/reset">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const ok = token ? await peekToken(token, "reset") : null;
  if (!ok) return (<><h1 className="text-xl font-semibold">Link expired</h1><p className="mb-5 mt-1 text-sm text-muted">This reset link is invalid, expired, or already used.</p><Link href="/forgot" className="text-brand-hover hover:underline">Request a new one</Link></>);
  return (<><h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1><p className="mb-5 mt-1 text-sm text-muted">At least 12 characters.</p><SetPasswordForm action={resetPassword} token={token} /></>);
}
