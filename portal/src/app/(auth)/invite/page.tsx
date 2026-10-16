import Link from "next/link";
import { acceptInvite } from "@/lib/auth/actions";
import { describeInvite } from "@/lib/auth/token-info";
import { SetPasswordForm } from "@/components/forms/set-password";

export const metadata = { title: "Set up your account" };

export default async function InvitePage({ searchParams }: PageProps<"/invite">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const info = token ? await describeInvite(token) : null;
  if (!info) return (<><h1 className="text-xl font-semibold">Invite expired</h1><p className="mb-5 mt-1 text-sm text-muted">This invite is invalid, expired, or already used. Ask Kynetic for a new one.</p><Link href="/login" className="text-brand-hover hover:underline">Go to sign in</Link></>);
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">{info.clientName ? `Welcome to ${info.clientName}` : "Set up your account"}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{info.email} · choose a password (12+ characters).</p>
      <SetPasswordForm action={acceptInvite} token={token} withName />
    </>
  );
}
