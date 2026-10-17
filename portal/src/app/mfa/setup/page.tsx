import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { MfaSetup } from "./mfa-setup";
import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Set up two-factor" };

export default async function MfaSetupPage() {
  const s = await requireUser();
  if (s.role !== "admin" || s.totpEnabled) redirect(s.role === "admin" ? "/admin" : "/");
  return (
    <div className="mx-auto grid max-w-sm gap-4 px-4 py-12">
      <Logo />
      <h1 className="text-xl font-semibold tracking-tight">Set up two-factor authentication</h1>
      <p className="text-sm text-muted">Admin accounts require an authenticator app (1Password, Authy, Google Authenticator). Scan the code, then enter the 6-digit number.</p>
      <MfaSetup />
    </div>
  );
}
