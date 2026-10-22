import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { GoogleButton } from "./google-button";
import { googleEnabled } from "@/lib/auth/google";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  if (await getSession()) redirect("/");
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Sign in to your Kynetic portal.</p>
      {sp.changed ? <p className="mb-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-text">Password changed. Please sign in again.</p> : null}
      {sp.error === "AccessDenied" ? <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-text">That Google account hasn&apos;t been invited to the portal. Ask Kynetic for access, or sign in with your email and password.</p> : null}
      <LoginForm next={next} />
      {googleEnabled() ? <GoogleButton /> : null}
    </>
  );
}
